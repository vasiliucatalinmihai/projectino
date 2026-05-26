/** Shape of the JWT payload signed at login and verified by the middleware. */
export interface JwtPayload {
  sub: number; // user id
  email: string;
}
