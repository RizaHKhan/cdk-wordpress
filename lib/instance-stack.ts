import { Duration, Stack, StackProps } from "aws-cdk-lib";
import { AutoScalingGroup, Signals } from "aws-cdk-lib/aws-autoscaling";
import {
  Vpc,
  AmazonLinuxImage,
  InstanceType,
  SubnetType,
  LaunchTemplate,
  SecurityGroup,
  AmazonLinuxGeneration,
  KeyPair,
  CloudFormationInit,
  InitCommand,
} from "aws-cdk-lib/aws-ec2";
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
  asg: AutoScalingGroup;

  constructor(scope: Construct, id: string, props: InstanceStackProps) {
    super(scope, id, props);

    const launchTemplate = new LaunchTemplate(this, "WordpressLaunchTemplate", {
      instanceType: new InstanceType("t2.micro"),
      machineImage: new AmazonLinuxImage({
        generation: AmazonLinuxGeneration.AMAZON_LINUX_2023,
      }),
      role: props.role,
      securityGroup: props.securityGroup,
      keyPair: props.keyPair,
    });

    this.asg = new AutoScalingGroup(this, "WordpressASG", {
      vpc: props.vpc,
      launchTemplate,
      vpcSubnets: { subnetType: SubnetType.PUBLIC },
      desiredCapacity: 1,
      init: CloudFormationInit.fromElements(
        InitCommand.shellCommand("sudo yum update -y"),
        InitCommand.shellCommand(
          "sudo yum install php wget httpd stress mariadb105-server php-{pear,cgi,common,curl,mbstring,gd,mysqlnd,gettext,bcmath,json,xml,fpm,intl,zip} -y"
        ),
        InitCommand.shellCommand("sudo systemctl enable httpd"),
        InitCommand.shellCommand("sudo systemctl start httpd"),
        InitCommand.shellCommand(
          "sudo wget http://wordpress.org/latest.tar.gz -P /var/www/html && cd /var/www/html && sudo tar -zxvf latest.tar.gz"
        ),
        InitCommand.shellCommand(
          "sudo cp -rvf /var/www/html/wordpress/* /var/www/html/"
        ),
        InitCommand.shellCommand("sudo rm -R /var/www/html/wordpress -f"),
        InitCommand.shellCommand("sudo rm /var/www/html/latest.tar.gz -f"),

        InitCommand.shellCommand(
          `sudo cp /var/www/html/wp-config-sample.php /var/www/html/wp-config.php`
        ),

        InitCommand.shellCommand(
          `sudo sed -i "s/'database_name_here'/'wordpress'/g" /var/www/html/wp-config.php`
        ),
        InitCommand.shellCommand(
          `sudo sed -i "s/'username_here'/'admin'/g" /var/www/html/wp-config.php`
        ),
        InitCommand.shellCommand(
          `sudo sed -i "s/'password_here'/'password#1'/g" /var/www/html/wp-config.php`
        ),
        InitCommand.shellCommand(
          `sudo sed -i "s/'localhost'/'${props.db.dbInstanceEndpointAddress}'/g" /var/www/html/wp-config.php`
        ),

        InitCommand.shellCommand("sudo usermod -a -G apache ec2-user"),
        InitCommand.shellCommand("sudo chown -R ec2-user:apache /var/www"),
        InitCommand.shellCommand("sudo chmod 2775 /var/www"),
        InitCommand.shellCommand(
          "sudo find /var/www -type d -exec chmod 2775 {} \\;"
        ),
        InitCommand.shellCommand(
          "sudo find /var/www -type f -exec chmod 0664 {} \\;"
        )
      ),
      signals: Signals.waitForCount(0),
    });

    props.db.connections.allowDefaultPortFrom(this.asg);
  }
}
