#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { InstanceStack } from "../lib/instance-stack";
import { NetworkingStack } from "../lib/networking-stack";
import { KeypairStack } from "../lib/keypair-stack";
import { DatabaseStack } from "../lib/database-stack";

const app = new cdk.App();
const networking = new NetworkingStack(app, "NetworkingStack", {});

const keypair = new KeypairStack(app, "KeyPairStack", {});

const db = new DatabaseStack(app, "DatabaseStack", {
  vpc: networking.vpc,
});

new InstanceStack(app, "InstanceStack", {
  keyPair: keypair.keyPair,
  vpc: networking.vpc,
  securityGroup: networking.securityGroup,
  role: networking.role,
  db: db.rds,
});
