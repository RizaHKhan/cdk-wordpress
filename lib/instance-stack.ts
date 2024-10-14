import { Duration, Stack, StackProps } from "aws-cdk-lib";
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

interface InstanceStackProps extends StackProps {
  keyPair: KeyPair;
  securityGroup: SecurityGroup;
  role: Role;
  vpc: Vpc;
  db: DatabaseInstance;
}

export class InstanceStack extends Stack {
  private asg: AutoScalingGroup;
  private alb: ApplicationLoadBalancer;

  constructor(scope: Construct, id: string, props: InstanceStackProps) {
    super(scope, id, props);

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
      "systemctl restart httpd",
      "sudo cp /var/www/html/wp-config-sample.php /var/www/html/wp-config.php",
      `sudo sed -i "s/'database_name_here'/'wordpress'/g" /var/www/html/wp-config.php`,
      `sudo sed -i "s/'username_here'/'admin'/g" /var/www/html/wp-config.php`,
      `sudo sed -i "s/'password_here'/'password#1'/g" /var/www/html/wp-config.php`,
      `sudo sed -i "s/'localhost'/'${props.db.dbInstanceEndpointAddress}'/g" /var/www/html/wp-config.php`,
      "sudo usermod -a -G apache ec2-user",
      "sudo chown -R ec2-user:apache /var/www",
      "sudo chmod 2775 /var/www",
      "sudo find /var/www -type d -exec chmod 2775 {} \\;",
      "sudo find /var/www -type f -exec chmod 0664 {} \\;"
    );

    const launchTemplate = new LaunchTemplate(this, "WordpressLaunchTemplate", {
      instanceType: new InstanceType("t2.micro"),
      machineImage: new AmazonLinuxImage({
        generation: AmazonLinuxGeneration.AMAZON_LINUX_2023,
      }),
      role: props.role,
      securityGroup: props.securityGroup,
      keyPair: props.keyPair,
      userData,
    });

    this.asg = new AutoScalingGroup(this, "WordpressASG", {
      vpc: props.vpc,
      launchTemplate,
      vpcSubnets: { subnetType: SubnetType.PUBLIC },
      desiredCapacity: 1,
    });

    this.alb = new ApplicationLoadBalancer(this, "WordpressALB", {
      vpc: props.vpc,
      internetFacing: true,
      securityGroup: props.securityGroup,
    });

    const targetGroup = new ApplicationTargetGroup(
      this,
      "WordpressTargetGroup",
      {
        vpc: props.vpc,
        targetType: TargetType.INSTANCE,
        port: 80,
        targets: [this.asg],
        healthCheck: {
          path: "/",
          interval: Duration.minutes(1),
        },
      }
    );

    this.alb.addListener("WordpressListener", {
      port: 80,
      open: true,
      defaultTargetGroups: [targetGroup],
    });

    props.db.connections.allowDefaultPortFrom(this.asg);
  }
}
