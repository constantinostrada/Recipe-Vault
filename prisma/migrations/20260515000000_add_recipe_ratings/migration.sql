-- CreateTable
CREATE TABLE "recipe_ratings" (
    "id" UUID NOT NULL,
    "recipe_id" UUID NOT NULL,
    "value" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipe_ratings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "recipe_ratings_value_check" CHECK ("value" >= 1 AND "value" <= 5)
);

-- CreateIndex
CREATE INDEX "recipe_ratings_recipe_id_idx" ON "recipe_ratings"("recipe_id");

-- AddForeignKey
ALTER TABLE "recipe_ratings" ADD CONSTRAINT "recipe_ratings_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
