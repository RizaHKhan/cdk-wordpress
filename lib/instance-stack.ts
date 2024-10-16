import { Duration, StackProps } from "aws-cdk-lib";
import { AutoScalingGroup } from "aws-cdk-lib/aws-autoscaling";
import {
  Vpc,
  AmazonLinuxImage,
  InstanceType,
  SubnetType,
  LaunchTemplate,
  SecurityGroup,
  AmazonLinuxGeneration,
  KeyPair,
  UserData,
} from "aws-cdk-lib/aws-ec2";
import {
  ApplicationLoadBalancer,
  ApplicationTargetGroup,
  TargetType,
} from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { Role } from "aws-cdk-lib/aws-iam";
import { DatabaseInstance } from "aws-cdk-lib/aws-rds";
import { Construct } from "constructs";
import { StackExtender } from "../utils/StackExtender";
import {
  AllowedMethods,
  CachePolicy,
  Distribution,
  OriginProtocolPolicy,
  OriginRequestPolicy,
  ViewerProtocolPolicy,
} from "aws-cdk-lib/aws-cloudfront";
import { LoadBalancerV2Origin } from "aws-cdk-lib/aws-cloudfront-origins";
import { Certificate } from "aws-cdk-lib/aws-certificatemanager";
import { ARecord, HostedZone, RecordTarget } from "aws-cdk-lib/aws-route53";
import { CloudFrontTarget } from "aws-cdk-lib/aws-route53-targets";

interface InstanceStackProps extends StackProps {
  keyPair: KeyPair;
  securityGroup: SecurityGroup;
  role: Role;
  vpc: Vpc;
  db: DatabaseInstance;
  certificate: Certificate;
  hostedZone: HostedZone;
}

export class InstanceStack extends StackExtender {
  constructor(scope: Construct, props: InstanceStackProps) {
    super(scope, "InstanceStack", props);

    const { certificate, hostedZone, db, role, vpc, securityGroup, keyPair } =
      props;

    const userData = UserData.forLinux();

    userData.addCommands(
      "yum update -y",
      "yum install -y httpd php php-mysqlnd",
      "systemctl start httpd",
      "systemctl enable httpd",
      "cd /var/www/html",
      "wget https://wordpress.org/latest.tar.gz",
      "tar -xzf latest.tar.gz",
      "cp -r wordpress/* /var/www/html/",
      "rm -rf wordpress",
      "rm -rf latest.tar.gz",
      "chown -R apache:apache /var/www/html/",
      "sudo cp /var/www/html/wp-config-sample.php /var/www/html/wp-config.php",
      `sudo sed -i "s/'database_name_here'/'wordpress'/g" /var/www/html/wp-config.php`,
      `sudo sed -i "s/'username_here'/'admin'/g" /var/www/html/wp-config.php`,
      `sudo sed -i "s/'password_here'/'password#1'/g" /var/www/html/wp-config.php`,
      `sudo sed -i "s/'localhost'/'${db.dbInstanceEndpointAddress}'/g" /var/www/html/wp-config.php`,
      `sudo sed -i "/define( 'DB_COLLATE', '' );/a define('WP_SITEURL', 'https://www.${this.domainName}');" /var/www/html/wp-config.php`,
      `sudo sed -i "/define( 'DB_COLLATE', '' );/a define('WP_HOME', 'https://www.${this.domainName}');" /var/www/html/wp-config.php`,
      "systemctl restart httpd",
      "sudo usermod -a -G apache ec2-user",
      "sudo chown -R ec2-user:apache /var/www",
      "sudo chmod 2775 /var/www",
      "sudo find /var/www -type d -exec chmod 2775 {} \\;",
      "sudo find /var/www -type f -exec chmod 0664 {} \\;",
    );

    const launchTemplate = new LaunchTemplate(this, "WordpressLaunchTemplate", {
      instanceType: new InstanceType("t2.micro"),
      machineImage: new AmazonLinuxImage({
        generation: AmazonLinuxGeneration.AMAZON_LINUX_2023,
      }),
      role,
      securityGroup,
      keyPair,
      userData,
    });

    const asg = new AutoScalingGroup(this, "WordpressASG", {
      vpc: vpc,
      launchTemplate,
      vpcSubnets: { subnetType: SubnetType.PUBLIC },
      desiredCapacity: 1,
    });

    const applicationLoadBalancer = new ApplicationLoadBalancer(
      this,
      "WordpressALB",
      {
        vpc,
        internetFacing: true,
        securityGroup,
      },
    );

    const targetGroup = new ApplicationTargetGroup(
      this,
      "WordpressTargetGroup",
      {
        vpc,
        targetType: TargetType.INSTANCE,
        port: 80,
        targets: [asg],
        healthCheck: {
          path: "/",
          interval: Duration.minutes(1),
        },
      },
    );

    applicationLoadBalancer.addListener("WordpressListener", {
      port: 80,
      open: true,
      defaultTargetGroups: [targetGroup],
    });

    db.connections.allowDefaultPortFrom(asg);

    const distribution = new Distribution(
      this,
      this.setConstructName("Distribution"),
      {
        defaultBehavior: {
          origin: new LoadBalancerV2Origin(applicationLoadBalancer, {
            protocolPolicy: OriginProtocolPolicy.HTTP_ONLY,
          }),
          allowedMethods: AllowedMethods.ALLOW_ALL,
          viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: CachePolicy.CACHING_DISABLED,
          originRequestPolicy: OriginRequestPolicy.ALL_VIEWER,
        },
        domainNames: [`www.${this.domainName}`, this.domainName],
        certificate: certificate,
      },
    );

    // A Record for www
    new ARecord(this, "ARecord", {
      zone: hostedZone,
      target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
      recordName: `www.${this.domainName}`,
    });

    // A Record for root domain
    new ARecord(this, "RootARecord", {
      zone: hostedZone,
      target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
      recordName: this.domainName, // root domain
    });
  }
}
