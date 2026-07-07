CREATE DATABASE IF NOT EXISTS ai_learning
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ai_learning;

CREATE TABLE IF NOT EXISTS users (
  id            VARCHAR(64)  NOT NULL PRIMARY KEY COMMENT '用户ID（UUID）',
  username      VARCHAR(64)  NOT NULL UNIQUE COMMENT '用户名',
  password_hash VARCHAR(255) NOT NULL COMMENT 'bcrypt 密码哈希',
  created_at    BIGINT       NOT NULL COMMENT '创建时间戳（毫秒）',
  updated_at    BIGINT       NOT NULL COMMENT '最后更新时间戳（毫秒）',

  KEY idx_username (username) COMMENT '按用户名查询'
) COMMENT='用户表';

CREATE TABLE IF NOT EXISTS chat_sessions (
  id          VARCHAR(64)  NOT NULL PRIMARY KEY COMMENT '会话ID（UUID）',
  user_id     VARCHAR(64)  NULL     COMMENT '用户ID',
  title       VARCHAR(255) NOT NULL DEFAULT '新对话' COMMENT '会话标题',
  created_at  BIGINT       NOT NULL COMMENT '创建时间戳（毫秒）',
  updated_at  BIGINT       NOT NULL COMMENT '最后更新时间戳（毫秒）',

  CONSTRAINT fk_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,

  KEY idx_user_id_updated (user_id, updated_at DESC) COMMENT '按用户查询最近会话'
) COMMENT='AI 对话会话表';

CREATE TABLE IF NOT EXISTS chat_messages (
  id          VARCHAR(64)  NOT NULL PRIMARY KEY COMMENT '消息ID（UUID）',
  session_id  VARCHAR(64)  NOT NULL COMMENT '所属会话ID',
  role        VARCHAR(16)  NOT NULL COMMENT '角色：system/user/assistant',
  type        VARCHAR(16)  NOT NULL DEFAULT 'text' COMMENT '类型：text/event-list',
  content     TEXT         NOT NULL COMMENT '消息内容',
  payload     JSON         NULL     COMMENT '经营事件等结构化数据',
  timestamp   BIGINT       NOT NULL COMMENT '消息时间戳（毫秒）',
  created_at  BIGINT       NOT NULL COMMENT '入库时间戳（毫秒）',

  CONSTRAINT fk_session
    FOREIGN KEY (session_id) REFERENCES chat_sessions(id)
    ON DELETE CASCADE,

  KEY idx_session_created (session_id, created_at) COMMENT '按会话查询消息'
) COMMENT='AI 对话消息表';
