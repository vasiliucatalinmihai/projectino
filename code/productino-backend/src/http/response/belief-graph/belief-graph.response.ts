import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BeliefNodeType,
  BeliefStatus,
  ConflictStatus,
  CoverageStatus,
  QuestionImpact,
  QuestionStatus,
  SourceKind,
} from '@prisma/client';
import {
  BeliefNode,
  Conflict,
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

  static fromEntity(source: Source): SourceResponse {
    return new SourceResponse({
      id: source.id,
      kind: source.kind,
      label: source.label ?? null,
      content: source.content,
      round: source.round,
      createdAt: source.createdAt,
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

  static fromEntity(node: BeliefNode): BeliefNodeResponse {
    return new BeliefNodeResponse({
      id: node.id,
      nodeType: node.nodeType,
      kind: node.kind,
      name: node.name,
      description: node.description ?? null,
      status: node.status,
      confidence: node.confidence,
      coverageKey: node.coverageKey ?? null,
      provenance: Array.isArray(node.provenance) ? node.provenance : [],
      round: node.round,
      extra: (node.extra ?? {}) as Record<string, any>,
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

  static fromEntity(coverageArea: CoverageArea): CoverageAreaResponse {
    return new CoverageAreaResponse({
      id: coverageArea.id,
      key: coverageArea.key,
      name: coverageArea.name,
      weight: coverageArea.weight,
      rollupConfidence: coverageArea.rollupConfidence,
      status: coverageArea.status,
      round: coverageArea.round,
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

  static fromEntity(question: Question): QuestionResponse {
    return new QuestionResponse({
      id: question.id,
      coverageKey: question.coverageKey ?? null,
      text: question.text,
      assumedAnswer: question.assumedAnswer ?? null,
      impact: question.impact,
      status: question.status,
      answerText: question.answerText ?? null,
      round: question.round,
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

  static fromEntity(round: ProjectRound): ProjectRoundResponse {
    return new ProjectRoundResponse({
      index: round.index,
      rollupConfidence: round.rollupConfidence,
      createdAt: round.createdAt,
    });
  }
}

export class ConflictResponse {
  @ApiProperty({ example: 1 }) id: number;
  @ApiProperty({ example: 'Tenancy model contradiction' }) summary: string;
  @ApiProperty() detail: string;
  @ApiProperty() beliefA: string;
  @ApiProperty() beliefB: string;
  @ApiProperty({ enum: ConflictStatus }) status: ConflictStatus;
  @ApiProperty({ example: 1 }) round: number;

  constructor(partial: Partial<ConflictResponse>) {
    Object.assign(this, partial);
  }

  static fromEntity(conflict: Conflict): ConflictResponse {
    return new ConflictResponse({
      id: conflict.id,
      summary: conflict.summary,
      detail: conflict.detail,
      beliefA: conflict.beliefA,
      beliefB: conflict.beliefB,
      status: conflict.status,
      round: conflict.round,
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
  @ApiProperty({ type: [ConflictResponse] }) conflicts: ConflictResponse[];

  constructor(partial: Partial<BeliefGraphResponse>) {
    Object.assign(this, partial);
  }

  static build(layers: {
    projectId: number;
    sources: Source[];
    coverageAreas: CoverageArea[];
    nodes: BeliefNode[];
    questions: Question[];
    rounds: ProjectRound[];
    conflicts: Conflict[];
  }): BeliefGraphResponse {
    const lastRound = layers.rounds[layers.rounds.length - 1];
    return new BeliefGraphResponse({
      projectId: layers.projectId,
      rollupConfidence: lastRound?.rollupConfidence ?? 0,
      sources: layers.sources.map(SourceResponse.fromEntity),
      coverageAreas: layers.coverageAreas.map(CoverageAreaResponse.fromEntity),
      nodes: layers.nodes.map(BeliefNodeResponse.fromEntity),
      questions: layers.questions.map(QuestionResponse.fromEntity),
      rounds: layers.rounds.map(ProjectRoundResponse.fromEntity),
      conflicts: layers.conflicts.map(ConflictResponse.fromEntity),
    });
  }
}
