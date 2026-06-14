import { RemovalPolicy } from 'aws-cdk-lib';
import { AttributeType, StreamViewType, TableEncryptionV2, TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export interface SnapDynamoTableProps {
  /** Table name: 3–255 characters, [a-zA-Z0-9._-] only. */
  tableName: string;
  /** Partition key definition. */
  partitionKey: { name: string; type: AttributeType };
  /** Optional sort key definition. */
  sortKey?: { name: string; type: AttributeType };
  /** Removal policy supplied by the caller (resolved from environments.ts). */
  removalPolicy: RemovalPolicy;
  /** Optional TTL attribute name. When provided, TTL is enabled on the table. */
  timeToLiveAttribute?: string;
  /** Optional DynamoDB Streams view type. When provided, streams are enabled. */
  stream?: StreamViewType;
}

const VALID_ENVS = ['dev', 'staging', 'prod'] as const;

/**
 * Reusable Level-2 CDK construct for DynamoDB tables.
 *
 * Enforces project-standard defaults on every table:
 * - On-demand billing (PAY_PER_REQUEST) — TableV2 default
 * - Point-In-Time Recovery enabled
 * - AWS-managed encryption
 * - Removal policy from props (validated in environments.ts before this point)
 *
 * Also validates the `env` CDK context variable at construct instantiation time,
 * throwing synchronously if it is absent or not in ['dev', 'staging', 'prod'].
 */
export class SnapDynamoTable extends Construct {
  /** Underlying TableV2 instance — callers can add GSIs and enable streams. */
  public readonly table: TableV2;

  constructor(scope: Construct, id: string, props: SnapDynamoTableProps) {
    super(scope, id);

    // Validate env context synchronously — before any CDK resource is created.
    const env = this.node.tryGetContext('env') as string | undefined;
    if (env === undefined || env === null || env === '') {
      throw new Error(
        `CDK context variable "env" is required but was not provided. ` +
          `Pass it with --context env=<value>. Valid options are: ${JSON.stringify(VALID_ENVS)}.`,
      );
    }
    if (!(VALID_ENVS as readonly string[]).includes(env)) {
      throw new Error(
        `Unrecognised CDK context variable "env": "${env}". ` +
          `Valid options are: ${JSON.stringify(VALID_ENVS)}.`,
      );
    }

    this.table = new TableV2(this, 'Table', {
      tableName: props.tableName,
      partitionKey: props.partitionKey,
      sortKey: props.sortKey,
      pointInTimeRecovery: true,
      encryption: TableEncryptionV2.awsManagedKey(),
      removalPolicy: props.removalPolicy,
      timeToLiveAttribute: props.timeToLiveAttribute,
      dynamoStream: props.stream,
    });
  }
}
