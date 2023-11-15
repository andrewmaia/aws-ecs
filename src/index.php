<!-- @format -->

<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Teste ECS</title>
  </head>

  <body style="background-color: red">
    Olá! Eu sou o container de IP:
    <?php
      $myfile = fopen("ipadress.txt", "r") or die("Unable to open file!");
      echo fread($myfile,filesize("ipadress.txt"));
      fclose($myfile);
    ?>
  </body>
</html>
