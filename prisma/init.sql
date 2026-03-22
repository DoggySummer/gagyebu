-- 가계부 DB: users + transactions(userId) + monthly_reports
-- MySQL 실행 순서: 1) DB 생성 → 2) 테이블 생성 → 3) users 시드

CREATE DATABASE IF NOT EXISTS GAGYEBU
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE GAGYEBU;

-- 1. users (id 1 = 아빠, 2 = 길웅 — database.md)
CREATE TABLE IF NOT EXISTS users (
  id        INT          NOT NULL AUTO_INCREMENT,
  name      VARCHAR(50)  NOT NULL,
  createdAt DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO users (id, name) VALUES (1, '아빠'), (2, '길웅');

-- 2. transactions (단일 테이블, userId로 구분)
CREATE TABLE IF NOT EXISTS transactions (
  id          INT          NOT NULL AUTO_INCREMENT,
  userId      INT          NOT NULL,
  date        DATE         NOT NULL,
  card        VARCHAR(50)  NOT NULL,
  payType     VARCHAR(20)  NOT NULL,
  merchant    VARCHAR(255) NOT NULL,
  amount      INT          NOT NULL,
  category   VARCHAR(50)  NULL,
  sourceFile VARCHAR(100) NULL,
  createdAt   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (id),
  INDEX idx_user_date (userId, date),
  INDEX idx_user_category (userId, category),
  CONSTRAINT fk_transactions_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. monthly_reports
CREATE TABLE IF NOT EXISTS monthly_reports (
  id        INT          NOT NULL AUTO_INCREMENT,
  userId    INT          NOT NULL,
  monthKey  VARCHAR(7)   NOT NULL,
  body      TEXT         NOT NULL,
  createdAt DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (id),
  UNIQUE KEY monthly_reports_userId_monthKey (userId, monthKey),
  INDEX idx_user (userId),
  CONSTRAINT fk_monthly_reports_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
