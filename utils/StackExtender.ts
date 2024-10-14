import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";

export class StackExtender extends Stack {
  public domainName: string;
  public appName: string;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.appName = scope.node.getContext("appName");
    this.domainName = scope.node.getContext("domainName");
  }

  setStackName(stack: string) {
    return `${this.appName}${stack}`;
  }

  setConstructName(construct: string) {
    return `${this.stackName}${construct}`;
  }
}
