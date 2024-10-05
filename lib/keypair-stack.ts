import { Stack, StackProps } from "aws-cdk-lib";
import { KeyPair } from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";

export class KeypairStack extends Stack {
  keyPair: KeyPair;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.keyPair = new KeyPair(this, "WordpressKeyPair", {
      keyPairName: "WordpressKeyPair",
    });
  }
}
