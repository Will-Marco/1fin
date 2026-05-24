-- AlterTable: rename player_id to fcm_token in device_tokens
ALTER TABLE "device_tokens" RENAME COLUMN "player_id" TO "fcm_token";

-- RenameIndex
ALTER INDEX "device_tokens_player_id_key" RENAME TO "device_tokens_fcm_token_key";
