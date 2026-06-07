<?php
// positive: PHP Elvis-operator default for a secret env var
$secretKey = getenv('SECRET_KEY') ?: 'insecure-default-secret';
