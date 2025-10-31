/**
 * Cleanup Migration - Delete all vocabulary entries
 * 
 * Run this before re-importing to clean up bad data
 */

module.exports = {
  async up() {
    console.log('\n🧹 Cleaning up vocabulary entries...\n');
    
    await strapi.db.transaction(async () => {
      // Delete all vocabulary entries
      const entries = await strapi.entityService.findMany('api::vocabulary.vocabulary', {
        limit: -1, // Get all entries
      });

      let deleted = 0;
      for (const entry of entries) {
        await strapi.entityService.delete('api::vocabulary.vocabulary', entry.id);
        deleted++;
      }

      console.log(`✓ Deleted ${deleted} vocabulary entries\n`);
    });
  },

  async down() {
    // Nothing to rollback
  },
};
