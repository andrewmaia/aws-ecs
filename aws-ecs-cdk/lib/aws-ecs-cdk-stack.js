/** @format */

const { Stack, Duration } = require("aws-cdk-lib");
const ec2 = require("aws-cdk-lib/aws-ec2");
const ecs = require("aws-cdk-lib/aws-ecs");
const cdk = require("aws-cdk-lib/core");
const iam = require("aws-cdk-lib/aws-iam");
const ecsPatterns = require("aws-cdk-lib/aws-ecs-patterns");
const codebuild = require("aws-cdk-lib/aws-codebuild");
const codepipeline = require("aws-cdk-lib/aws-codepipeline");
const s3 = require("aws-cdk-lib/aws-s3");
const codepipeline_actions = require("aws-cdk-lib/aws-codepipeline-actions");
const codestarconnections = require("aws-cdk-lib/aws-codestarconnections");

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
    const ecsTaskExecutionRole = new iam.Role(this, "EcsTaskExecutionRole", {
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
        "884588048908.dkr.ecr.us-east-1.amazonaws.com/repositoryecsteste:latest"
      ),

      entryPoint: ["sh", "-c"],
      command: [
        '/bin/sh -c "echo $(hostname -i) > /var/www/html/ipadress.txt && apache2-foreground"',
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

    ////////////****Pipeline*******////////////////

    //ArtifactBucket
    const artifactBucket = new s3.Bucket(this, "Bucket", {
      bucketName: "artifactbucketecsteste",
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    //Codebuild
    const codeBuildServiceRole = new iam.Role(this, "CodeBuildServiceRole", {
      roleName: "CodeBuildServiceRoleEcsTeste",
      assumedBy: new iam.ServicePrincipal("codebuild.amazonaws.com"),
    });

    codeBuildServiceRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        resources: ["*"],
        actions: [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "ecr:GetAuthorizationToken",
        ],
      })
    );

    codeBuildServiceRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        resources: ["*"],
        actions: ["s3:GetObject", "s3:PutObject", "s3:GetObjectVersion"],
      })
    );

    codeBuildServiceRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        resources: ["*"],
        actions: [
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:BatchCheckLayerAvailability",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
        ],
      })
    );

    const codebuildProject = new codebuild.PipelineProject(
      this,
      "CodeBuildProject",
      {
        projectName: "CodeBuildProjectEcsTeste",
        role: codeBuildServiceRole,

        buildSpec: codebuild.BuildSpec.fromObject({
          version: "0.2",
          phases: {
            install: {
              runtime_versions: "python: 3.11",
              commands: [
                "pip install --upgrade pip",
                "pip install --upgrade awscli aws-sam-cli",
              ],
            },
            pre_build: {
              commands: [
                "$(aws ecr get-login --no-include-email)",
                'TAG="$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION | head -c 8)"',
                'IMAGE_URI="${REPOSITORY_URI}:${TAG}"',
              ],
            },
            build: {
              commands: ['docker build --tag "$IMAGE_URI" .'],
            },
            post_build: {
              commands: [
                'docker push "$IMAGE_URI"',
                'printf \'[{"name":"ContainerEcsTeste","imageUri":"%s"}]\' "$IMAGE_URI" > images.json',
              ],
            },
          },
          artifacts: { files: "images.json" },
        }),
        environment: {
          computeType: codebuild.ComputeType.SMALL,
          buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_5,
          privileged: true,
        },
        environmentVariables: {
          AWS_DEFAULT_REGION: { value: cdk.Stack.of(this).region },
          REPOSITORY_URI: {
            value:
              "884588048908.dkr.ecr.us-east-1.amazonaws.com/repositoryecsteste",
          },
        },
      }
    );

    //Pipeline

    const codePipelineServiceRole = new iam.Role(
      this,
      "CodePipelineServiceRole",
      {
        roleName: "CodePipelineServiceRoleEcsTeste",
        assumedBy: new iam.ServicePrincipal("codepipeline.amazonaws.com"),
      }
    );

    codePipelineServiceRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        resources: ["*"],
        actions: [
          "s3:GetObject",
          "s3:PutObject",
          "s3:GetObjectVersion",
          "s3:GetBucketVersioning",
        ],
      })
    );

    codePipelineServiceRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        resources: ["*"],
        actions: [
          "ecs:DescribeServices",
          "ecs:DescribeTaskDefinition",
          "ecs:DescribeTasks",
          "ecs:ListTasks",
          "ecs:RegisterTaskDefinition",
          "ecs:UpdateService",
          "codebuild:StartBuild",
          "codebuild:BatchGetBuilds",
          "iam:PassRole",
        ],
      })
    );

    const pipeline = new codepipeline.Pipeline(this, "Pipeline", {
      pipelineName: "pipelineEcsTeste",
      artifactBucket: artifactBucket,
      role: codePipelineServiceRole,
    });

    //Source
    /*const codeStarConnection = new codestarconnections.CfnConnection(
      this,
      "CodestarConnection",
      {
        connectionName: "GitRepositoryConnectionEcsTeste",
        providerType: "GitHub",
      }
    );*/

    const sourceOutput = new codepipeline.Artifact();
    const sourceAction =
      new codepipeline_actions.CodeStarConnectionsSourceAction({
        actionName: "SourceAction",
        owner: "andrewmaia",
        repo: "aws-ecs",
        branch: "master",
        //        connectionArn: codeStarConnection.attrConnectionArn,
        connectionArn:
          "arn:aws:codestar-connections:us-east-1:884588048908:connection/891bc702-0bcb-46ea-a1fc-8f1857cdf42f",
        output: sourceOutput,
      });

    pipeline.addStage({
      stageName: "Source",
      actions: [sourceAction],
    });

    //Build
    const buildOutput = new codepipeline.Artifact("BuildArtifact");
    const buildAction = new codepipeline_actions.CodeBuildAction({
      actionName: "BuildAction",
      project: codebuildProject,
      input: sourceOutput,
      outputs: [buildOutput],
    });

    pipeline.addStage({
      stageName: "Build",
      actions: [buildAction],
    });

    //Deploy
    const deployAction = new codepipeline_actions.EcsDeployAction({
      actionName: "DeployAction",
      service: fargateLoadBalancedService.service,
      imageFile: buildOutput.atPath("images.json"),
    });

    pipeline.addStage({
      stageName: "Deploy",
      actions: [deployAction],
    });
  }
}

module.exports = { AwsEcsCdkStack };
