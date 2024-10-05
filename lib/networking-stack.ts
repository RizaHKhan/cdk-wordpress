import { Stack, StackProps } from "aws-cdk-lib";
import {
  Vpc,
  SubnetType,
  FlowLog,
  FlowLogDestination,
  FlowLogResourceType,
  SecurityGroup,
  Peer,
  Port,
  IpAddresses,
} from "aws-cdk-lib/aws-ec2";
import { ManagedPolicy, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export class NetworkingStack extends Stack {
  vpc: Vpc;
  role: Role;
  securityGroup: SecurityGroup;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.vpc = new Vpc(this, "WordpressVpc", {
      vpcName: "WordpressVpc",
      ipAddresses: IpAddresses.cidr("10.0.0.0/16"),
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          name: "Public",
          cidrMask: 24,
          subnetType: SubnetType.PUBLIC,
        },
        {
          name: "Private",
          cidrMask: 24,
          subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });

    new FlowLog(this, "VpcFlowLog", {
      resourceType: FlowLogResourceType.fromVpc(this.vpc),
      destination: FlowLogDestination.toCloudWatchLogs(),
    });

    this.role = new Role(this, "SSMRole", {
      assumedBy: new ServicePrincipal("ec2.amazonaws.com"),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore"),
      ],
    });

    this.securityGroup = new SecurityGroup(this, "WordpressSG", {
      securityGroupName: "PublicSG",
      vpc: this.vpc,
      allowAllOutbound: true,
    });

    this.securityGroup.addIngressRule(
      Peer.anyIpv4(),
      Port.tcp(443),
      "Allow HTTPS"
    );

    this.securityGroup.addIngressRule(
      Peer.anyIpv4(),
      Port.tcp(80),
      "Allow HTTP"
    );

    // Restrict SSH access to EC2 Instance Connect service IP addresses for the region
    this.securityGroup.addIngressRule(
      Peer.ipv4("0.0.0.0/0"),
      Port.tcp(22),
      "Allow SSH from EC2 Instance Connect IPs"
    );
  }
}
