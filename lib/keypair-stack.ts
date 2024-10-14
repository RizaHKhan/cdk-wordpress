import { StackProps } from "aws-cdk-lib";
import { KeyPair } from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";
import { StackExtender } from "../utils/StackExtender";

export class KeypairStack extends StackExtender {
  keyPair: KeyPair;

  constructor(scope: Construct, props?: StackProps) {
    super(scope, "KeyPairStack", props);

    this.keyPair = new KeyPair(this, "WordpressKeyPair", {
      keyPairName: "WordpressKeyPair",
    });
  }
}
