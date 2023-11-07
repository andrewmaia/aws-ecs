/** @format */

const { Stack, Duration } = require("aws-cdk-lib");
const ec2 = require("aws-cdk-lib/aws-ec2");
const ecs = require("aws-cdk-lib/aws-ecs");
const ecs_patterns = require("aws-cdk-lib/aws-ecs-patterns");
const cw = require("aws-cdk-lib/aws-cloudwatch");

class AwsEcsCdkStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    //Outros
    const securityGroup = ec2.SecurityGroup.fromLookup(
      this,
      "Antiga-492",
      "sg-0a92485ead3e624ae"
    );

    const defaultVpc = ec2.Vpc.fromLookup(this, "default-vpc", {
      vpcName: "Default",
    });

    //Cluster
    const cluster = new ecs.Cluster(this, "ClusterTeste", {
      clusterName: "ClusterTeste",
      vpc: defaultVpc,
      containerInsights: true,
      enableFargateCapacityProviders: true,
    });

    //Task Definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, "TaskDef", {
      family: "taskDefinitionTeste",
      cpu: 256,
      memoryLimitMiB: 512,
    });

    const container = taskDefinition.addContainer("web", {
      containerName: "fargate-app",
      cpu: 0,
      essential: true,
      image: ecs.ContainerImage.fromRegistry(
        "public.ecr.aws/docker/library/httpd:latest"
      ),
      entryPoint: ["sh", "-c"],
      command: [
        '/bin/sh -c "echo $(hostname -i) >  /usr/local/apache2/htdocs/index.html && httpd-foreground"',
      ],
    });

    container.addPortMappings({
      containerPort: 80,
      hostPort: 80,
      protocol: "tcp",
    });

    //Service
    const service = new ecs.FargateService(this, "FargateService", {
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
    });

    const autoScale = service.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: 3,
    });
    autoScale.scaleOnCpuUtilization("CPUAutoscaling", {
      targetUtilizationPercent: 50,
      scaleInCooldown: Duration.seconds(30),
      scaleOutCooldown: Duration.seconds(30),
    });
  }
}

module.exports = { AwsEcsCdkStack };
