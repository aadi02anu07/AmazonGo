#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { getEnvironmentConfig } from '../config/environments';
import { SnapDatabaseStack } from '../stacks/SnapDatabaseStack';

const app = new cdk.App();
const envName = (app.node.tryGetContext('env') as string | undefined) ?? 'dev';
const config = getEnvironmentConfig(envName); // throws on unrecognised env before any stack synthesised
new SnapDatabaseStack(app, `SnapDatabaseStack-${config.stage}`, {
  env: { account: config.account, region: config.region },
  config,
});
