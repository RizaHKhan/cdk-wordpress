import { SecretValue, StackProps } from "aws-cdk-lib";
import { SubnetType, Vpc } from "aws-cdk-lib/aws-ec2";
import {
  DatabaseInstance,
  DatabaseInstanceEngine,
  MysqlEngineVersion,
} from "aws-cdk-lib/aws-rds";
import { Construct } from "constructs";
import { StackExtender } from "../utils/StackExtender";

interface DatabaseStackProps extends StackProps {
  vpc: Vpc;
}

export class DatabaseStack extends StackExtender {
  rds: DatabaseInstance;

  constructor(scope: Construct, props: DatabaseStackProps) {
    super(scope, "DatabaseStack", props);

    this.rds = new DatabaseInstance(this, "WordpressRDS", {
      engine: DatabaseInstanceEngine.mysql({
        version: MysqlEngineVersion.VER_5_7,
      }),
      databaseName: "wordpress",
      vpc: props.vpc,
      credentials: {
        username: "admin",
        password: SecretValue.unsafePlainText("password#1"),
      },
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      publiclyAccessible: false,
      vpcSubnets: {
        subnetType: SubnetType.PRIVATE_WITH_EGRESS,
      },
    });
  }
}
