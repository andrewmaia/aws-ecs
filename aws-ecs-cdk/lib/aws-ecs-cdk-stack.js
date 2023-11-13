/** @format */

const { Stack, Duration } = require("aws-cdk-lib");
const ec2 = require("aws-cdk-lib/aws-ec2");
const ecs = require("aws-cdk-lib/aws-ecs");
const cdk = require("aws-cdk-lib/core");
const iam = require("aws-cdk-lib/aws-iam");
const ecsPatterns = require("aws-cdk-lib/aws-ecs-patterns");

class AwsEcsCdkStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    //VPC
    const vpc = new ec2.Vpc(this, "VPC", {
      vpcName: "VcpEcsTeste",
      ipAddresses: ec2.IpAddresses.cidr("10.0.0.0/24"),
    });

    //Security Group
    const securityGroup = new ec2.SecurityGroup(this, "SecurityGroup", {
      vpc,
      securityGroupName: "SecurityGroupEcsTeste",
      allowAllOutbound: true,
    });

    //Cluster
    const cluster = new ecs.Cluster(this, "Cluster", {
      clusterName: "ClusterEcsTeste",
      vpc: vpc,
      containerInsights: true,
    });

    //Task Definition
    const ecsTaskExecutionRole = new iam.Role(this, "Role", {
      roleName: "EcsTaskExecutionRoleEcsTeste",
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
    });

    ecsTaskExecutionRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        resources: ["*"],
        actions: [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ],
      })
    );

    const taskDefinition = new ecs.FargateTaskDefinition(
      this,
      "TaskDefinition",
      {
        family: "TaskDefinitionEcsTeste",
        cpu: 256,
        memoryLimitMiB: 512,
        executionRole: ecsTaskExecutionRole,
      }
    );

    const container = taskDefinition.addContainer("web", {
      containerName: "ContainerEcsTeste",
      essential: true,
      image: ecs.ContainerImage.fromRegistry(
        "884588048908.dkr.ecr.us-east-1.amazonaws.com/ecsteste:latest"
      ),
      entryPoint: ["sh", "-c"],
      command: [
        '/bin/sh -c "echo $(hostname -i) >  /var/www/html/ipadress.txt && apache2-foreground"',
      ],
    });

    container.addPortMappings({
      containerPort: 80,
      hostPort: 80,
      protocol: "tcp",
    });

    //Service
    const fargateLoadBalancedService =
      new ecsPatterns.ApplicationLoadBalancedFargateService(
        this,
        "EcsService",
        {
          cluster,
          taskDefinition,
          serviceName: "ServiceEcsTeste",
          desiredCount: 2,
          securityGroups: [securityGroup],
          loadBalancerName: "LoadBalancerEcsTeste",
          minHealthyPercent: 100,
          maxHealthyPercent: 200,
        }
      );

    /*const service = new ecs.FargateService(this, "FargateService", {
      cluster,
      taskDefinition,
      desiredCount: 1,
      deploymentAlarms: {
        alarmNames: ["AlermeTest"],
        behavior: ecs.AlarmBehavior.ROLLBACK_ON_ALARM,
      },
      securityGroups: [securityGroup],
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      assignPublicIp: true,
    });*/

    const autoScale = fargateLoadBalancedService.service.autoScaleTaskCount({
      minCapacity: 2,
      maxCapacity: 4,
    });

    autoScale.scaleOnCpuUtilization("CPUAutoscaling", {
      targetUtilizationPercent: 50,
      scaleInCooldown: Duration.seconds(30),
      scaleOutCooldown: Duration.seconds(30),
    });

    new cdk.CfnOutput(this, "UrlLoadbalancerAcessarSite", {
      value: fargateLoadBalancedService.loadBalancer.loadBalancerDnsName,
    });
  }
}

module.exports = { AwsEcsCdkStack };
