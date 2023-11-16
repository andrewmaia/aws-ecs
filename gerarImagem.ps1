echo "Gerando Imagem Docker..."
docker build -t ecsteste .


echo "Criando ECR Repository..."
$defaultRegion = aws configure get region
aws ecr create-repository --repository-name repositoryecsteste --region $defaultRegion

echo "Tag imagem com a URI do ECR Repository..."
$accountId = aws sts get-caller-identity --query "Account"
$accountId= $accountId -replace '"', ""   
$accountUri= -join($accountId, ".dkr.ecr.", $defaultRegion,".amazonaws.com");
$repositoryUri = -join($accountUri,"/repositoryecsteste");
docker tag ecsteste $repositoryUri

echo "Realizando login no ECR..."
aws ecr get-login-password --region $defaultRegion | docker login --username AWS --password-stdin $accountUri

echo "Subindo imagem para o ECR Repository..."
docker push $repositoryUri

echo "CDK Bootstrapping..."
cd aws-ecs-cdk
$cdkBootstrap = -join("aws://",$accountId,"/",$defaultRegion);
cdk bootstrap $cdkBootstrap

echo "CDK Deploy..."
cdk deploy
