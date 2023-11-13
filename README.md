## Para subir imagem para AWS ECR

```bash
docker build -t ecsteste .
aws ecr create-repository --repository-name ecsteste --region us-east-1
docker tag ecsteste 884588048908.dkr.ecr.us-east-1.amazonaws.com/ecsteste
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 884588048908.dkr.ecr.us-east-1.amazonaws.com
docker push 884588048908.dkr.ecr.us-east-1.amazonaws.com/ecsteste
```


## Para publicar a infra deste projeto usando AWS CDK

Na pasta aws-ecs-cdk rode os seguintes comandos:

```bash
cdk bootstrap aws://{seu Id AWS}/us-east-1
cdk deploy
```
