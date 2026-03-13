-- Prisma 스키마(Transaction) 기준 DB 세팅
-- MySQL 실행 순서: 1) DB 생성 → 2) 테이블 생성

-- 1. DB 생성 (DATABASE_URL의 DB명과 맞출 것)
CREATE DATABASE IF NOT EXISTS GAGYEBU
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE GAGYEBU;

-- 2. transactions 테이블 (Prisma @@map("transactions"))
CREATE TABLE IF NOT EXISTS transactions (
  id          INT          NOT NULL AUTO_INCREMENT,
  date        DATE         NOT NULL,
  card        VARCHAR(50)  NOT NULL,
  payType     VARCHAR(20)  NOT NULL,
  merchant    VARCHAR(255) NOT NULL,
  amount      INT          NOT NULL,
  category    VARCHAR(50)  NULL,
  subCategory VARCHAR(50)  NULL,
  sourceFile  VARCHAR(100) NULL,
  createdAt   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (id),
  INDEX idx_date (date),
  INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
