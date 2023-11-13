FROM php:8.2-apache
EXPOSE 80
COPY src/ /var/www/html/
