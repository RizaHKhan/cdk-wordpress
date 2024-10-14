#!/usr/bin/env node
import "source-map-support/register";
import { App } from "aws-cdk-lib";
import { InstanceStack } from "../lib/instance-stack";
import { NetworkingStack } from "../lib/networking-stack";
import { KeypairStack } from "../lib/keypair-stack";
import { DatabaseStack } from "../lib/database-stack";
import { env } from "process";
import { DistributionStack } from "../lib/distribution-stack";

const { CDK_DEFAULT_ACCOUNT } = env;
const domainName = "modernartisans.xyz";

const app = new App({
  context: {
    domainName,
    appName: "Authenticator",
    env: { region: "us-east-1", account: CDK_DEFAULT_ACCOUNT },
  },
});
const distribution = new DistributionStack(app);
const networking = new NetworkingStack(app, "NetworkingStack", {});

const keypair = new KeypairStack(app, "KeyPairStack", {});

const db = new DatabaseStack(app, "DatabaseStack", {
  vpc: networking.vpc,
});

const instance = new InstanceStack(app, "InstanceStack", {
  keyPair: keypair.keyPair,
  vpc: networking.vpc,
  securityGroup: networking.securityGroup,
  role: networking.role,
  db: db.rds,
  domainName,
});

distribution.createCloudfrontDistributionAndARecord(instance.alb);
