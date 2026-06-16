import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BeliefNodeType,
  BeliefStatus,
  CoverageStatus,
  QuestionImpact,
  QuestionStatus,
  SourceKind,
} from '@prisma/client';
import {
  BeliefNode,
  CoverageArea,
  ProjectRound,
  Provenance,
  Question,
  Source,
} from '../../../entities';

export class SourceResponse {
  @ApiProperty({ example: 1 }) id: number;
  @ApiProperty({ enum: SourceKind, example: SourceKind.BRIEFING }) kind: SourceKind;
  @ApiPropertyOptional({ nullable: true }) label: string | null;
  @ApiProperty({ description: 'Raw source text' }) content: string;
  @ApiProperty({ example: 1 }) round: number;
  @ApiProperty() createdAt: Date;

  constructor(partial: Partial<SourceResponse>) {
    Object.assign(this, partial);
  }

  static fromEntity(s: Source): SourceResponse {
    return new SourceResponse({
      id: s.id,
      kind: s.kind,
      label: s.label ?? null,
      content: s.content,
      round: s.round,
      createdAt: s.createdAt,
    });
  }
}

export class BeliefNodeResponse {
  @ApiProperty({ example: 1 }) id: number;
  @ApiProperty({ enum: BeliefNodeType }) nodeType: BeliefNodeType;
  @ApiProperty({ example: 'feature' }) kind: string;
  @ApiProperty({ example: 'Subscriptions' }) name: string;
  @ApiPropertyOptional({ nullable: true }) description: string | null;
  @ApiProperty({ enum: BeliefStatus }) status: BeliefStatus;
  @ApiProperty({ example: 0.55, description: 'Confidence, 0–1' }) confidence: number;
  @ApiPropertyOptional({ nullable: true, description: 'CoverageArea.key this node belongs to' })
  coverageKey: string | null;
  @ApiProperty({
    description: 'Provenance: [{ sourceId, span:[start,end], quote }]',
    type: 'array',
    items: { type: 'object', additionalProperties: true },
  })
  provenance: Provenance[];
  @ApiProperty({ example: 1 }) round: number;
  @ApiProperty({ type: 'object', additionalProperties: true }) extra: Record<string, any>;

  constructor(partial: Partial<BeliefNodeResponse>) {
    Object.assign(this, partial);
  }

  static fromEntity(n: BeliefNode): BeliefNodeResponse {
    return new BeliefNodeResponse({
      id: n.id,
      nodeType: n.nodeType,
      kind: n.kind,
      name: n.name,
      description: n.description ?? null,
      status: n.status,
      confidence: n.confidence,
      coverageKey: n.coverageKey ?? null,
      provenance: Array.isArray(n.provenance) ? n.provenance : [],
      round: n.round,
      extra: (n.extra ?? {}) as Record<string, any>,
    });
  }
}

export class CoverageAreaResponse {
  @ApiProperty({ example: 1 }) id: number;
  @ApiProperty({ example: 'compliance' }) key: string;
  @ApiProperty({ example: 'Compliance & Data Protection' }) name: string;
  @ApiProperty({ example: 'high' }) weight: string;
  @ApiProperty({ example: 0.2, description: 'Rollup confidence, 0–1' }) rollupConfidence: number;
  @ApiProperty({ enum: CoverageStatus }) status: CoverageStatus;
  @ApiProperty({ example: 1 }) round: number;

  constructor(partial: Partial<CoverageAreaResponse>) {
    Object.assign(this, partial);
  }

  static fromEntity(c: CoverageArea): CoverageAreaResponse {
    return new CoverageAreaResponse({
      id: c.id,
      key: c.key,
      name: c.name,
      weight: c.weight,
      rollupConfidence: c.rollupConfidence,
      status: c.status,
      round: c.round,
    });
  }
}

export class QuestionResponse {
  @ApiProperty({ example: 1 }) id: number;
  @ApiPropertyOptional({ nullable: true }) coverageKey: string | null;
  @ApiProperty() text: string;
  @ApiPropertyOptional({ nullable: true }) assumedAnswer: string | null;
  @ApiProperty({ enum: QuestionImpact }) impact: QuestionImpact;
  @ApiProperty({ enum: QuestionStatus }) status: QuestionStatus;
  @ApiPropertyOptional({ nullable: true }) answerText: string | null;
  @ApiProperty({ example: 1 }) round: number;

  constructor(partial: Partial<QuestionResponse>) {
    Object.assign(this, partial);
  }

  static fromEntity(q: Question): QuestionResponse {
    return new QuestionResponse({
      id: q.id,
      coverageKey: q.coverageKey ?? null,
      text: q.text,
      assumedAnswer: q.assumedAnswer ?? null,
      impact: q.impact,
      status: q.status,
      answerText: q.answerText ?? null,
      round: q.round,
    });
  }
}

export class ProjectRoundResponse {
  @ApiProperty({ example: 1 }) index: number;
  @ApiProperty({ example: 0.42, description: 'Weighted project rollup, 0–1' })
  rollupConfidence: number;
  @ApiProperty() createdAt: Date;

  constructor(partial: Partial<ProjectRoundResponse>) {
    Object.assign(this, partial);
  }

  static fromEntity(r: ProjectRound): ProjectRoundResponse {
    return new ProjectRoundResponse({
      index: r.index,
      rollupConfidence: r.rollupConfidence,
      createdAt: r.createdAt,
    });
  }
}

/** The whole Belief Graph for a project, assembled from its layers. */
export class BeliefGraphResponse {
  @ApiProperty({ example: 1 }) projectId: number;
  @ApiProperty({
    example: 0.42,
    description: 'Latest weighted project rollup (0–1); 0 until first scoring round',
  })
  rollupConfidence: number;
  @ApiProperty({ type: [SourceResponse] }) sources: SourceResponse[];
  @ApiProperty({ type: [CoverageAreaResponse] }) coverageAreas: CoverageAreaResponse[];
  @ApiProperty({ type: [BeliefNodeResponse] }) nodes: BeliefNodeResponse[];
  @ApiProperty({ type: [QuestionResponse] }) questions: QuestionResponse[];
  @ApiProperty({ type: [ProjectRoundResponse] }) rounds: ProjectRoundResponse[];

  constructor(partial: Partial<BeliefGraphResponse>) {
    Object.assign(this, partial);
  }

  static build(args: {
    projectId: number;
    sources: Source[];
    coverageAreas: CoverageArea[];
    nodes: BeliefNode[];
    questions: Question[];
    rounds: ProjectRound[];
  }): BeliefGraphResponse {
    const lastRound = args.rounds[args.rounds.length - 1];
    return new BeliefGraphResponse({
      projectId: args.projectId,
      rollupConfidence: lastRound?.rollupConfidence ?? 0,
      sources: args.sources.map(SourceResponse.fromEntity),
      coverageAreas: args.coverageAreas.map(CoverageAreaResponse.fromEntity),
      nodes: args.nodes.map(BeliefNodeResponse.fromEntity),
      questions: args.questions.map(QuestionResponse.fromEntity),
      rounds: args.rounds.map(ProjectRoundResponse.fromEntity),
    });
  }
}
