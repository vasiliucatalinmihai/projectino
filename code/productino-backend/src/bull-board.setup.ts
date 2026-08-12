import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getQueueToken } from '@nestjs/bullmq';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import type { NextFunction, Request, Response } from 'express';
import type { Queue } from 'bullmq';
import { JwtPayload } from './common/jwt-payload';
import { PIPELINE_QUEUE } from './common/pipeline-job';
import { UserRepository } from './repository';

const COOKIE_NAME = 'bull_board_token';

/** Bare-bones Cookie header parser — avoids pulling in cookie-parser for one value. */
function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  const prefix = `${name}=`;
  const match = header.split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : undefined;
}

/**
 * Mounts the Bull Board dashboard at /bull-board — deliberately outside the `/api` prefix (see
 * main.ts's setGlobalPrefix), reached directly as e.g. https://dev-api.production.io/bull-board.
 *
 * Bull Board has no auth of its own, so every request is gated in front of it here: same JWT
 * this app already issues at login, verified the same way AuthMiddleware does, but restricted to
 * SUPER_ADMIN — this is an ops view into every tenant's jobs, not a tenant-scoped feature.
 *
 * A plain browser navigation can't attach an `Authorization` header, so the token is also
 * accepted as a `?token=` query param — the frontend's "Bull Board" link (super-admin only)
 * appends the current session's token when opening it. That covers the *first* request only —
 * Bull Board's own JS/CSS and its internal API calls for job data can't repeat the query param
 * themselves, so the first successful auth also sets an httpOnly cookie scoped to /bull-board;
 * every follow-up request the browser makes for this page authenticates off that instead. Query-
 * param tokens do show up in browser history/server logs, an accepted trade-off for an internal
 * ops tool; swap for a proper SSO/cookie handoff if this ever needs to be reachable outside a
 * trusted network.
 */
export function setupBullBoard(app: INestApplication): void {
  const jwtService = app.get(JwtService);
  const userRepository = app.get(UserRepository);
  const queue = app.get<Queue>(getQueueToken(PIPELINE_QUEUE));

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/bull-board');
  createBullBoard({
    queues: [new BullMQAdapter(queue)],
    serverAdapter,
  });

  const requireSuperAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const header = req.headers['authorization'];
    const headerToken = header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : undefined;
    const queryToken = typeof req.query.token === 'string' ? req.query.token : undefined;
    const cookieToken = readCookie(req, COOKIE_NAME);
    const token = headerToken ?? queryToken ?? cookieToken;

    if (!token) {
      res.status(401).send('Unauthorized — pass a bearer token or ?token=');
      return;
    }
    try {
      const payload = await jwtService.verifyAsync<JwtPayload>(token);
      const user = await userRepository.findByIdWithPermissions(payload.sub);
      if (!user?.isSuperAdmin) {
        res.status(403).send('Forbidden — super admin only');
        return;
      }
      const isHttps = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https';
      res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: isHttps,
        maxAge: 60 * 60 * 1000, // 1h — well under the JWT's own expiry, just re-set on every visit
        path: '/bull-board',
      });
      next();
    } catch {
      res.status(401).send('Unauthorized — invalid or expired token');
    }
  };

  app.use('/bull-board', requireSuperAdmin, serverAdapter.getRouter());
}
