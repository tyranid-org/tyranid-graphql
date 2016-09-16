import { Tyr } from 'tyranid';

import {
  Blog,
  User,
  Team,
  Chart,
  Inventory,
  Organization,
  Comment } from './models';

export async function createTestData() {
  // nuke old data...
  await Promise.all(Tyr.collections.map(c => c.remove({})));

  /**
    Organiations
   */
  const [
    chipotle,
    chopped,
    cava
  ] = await Promise.all([
    Organization.insert({ name: 'Chipotle' }),
    Organization.insert({ name: 'Chopped' }),
    Organization.insert({ name: 'Cava' })
  ]);

  /**
    Organiations
   */
  const [
    // chipotleInventory,
    // choppedInventory,
    // cavaInventory
  ] = await Promise.all([
    Inventory.insert({ name: 'Chipotle', organizationId: chipotle.$id }),
    Inventory.insert({ name: 'Chopped', organizationId: chopped.$id }),
    Inventory.insert({ name: 'Cava', organizationId: cava.$id })
  ]);

  /**
    Blogs
   */
  const [
    chipotleFoodBlog,
    chipotleCorporateBlog,
    choppedBlog,
    cavaBlog
  ] = await Promise.all([
    Blog.insert({ name: 'Burritos Etc', organizationId: chipotle.$id }),
    Blog.insert({ name: 'Mexican Empire', organizationId: chipotle.$id }),
    Blog.insert({ name: 'Salads are great', organizationId: chopped.$id }),
    Blog.insert({ name: 'Spinach + Lentils', organizationId: cava.$id })
  ]);


  /**
    Posts
   */
  const [
    // whyBurritosAreAmazing,
    // ecoliChallenges,
    // weDontKnowWhyPeopleGotSick,
    // cleaningUp,
    // burritoManagement,
    // saladsAreGreat,
    // guacGreens,
    // lentilsAreGreat
  ] = await Promise.all([
    Blog.insert({ name: 'Why burritos are amazing.', blogId: chipotleFoodBlog.$id }),
    Blog.insert({ name: 'Ecoli challenges.', blogId: chipotleFoodBlog.$id }),
    Blog.insert({ name: 'We don\' actually know why people got sick.', blogId: chipotleFoodBlog.$id }),
    Blog.insert({ name: 'Re-evaluating the way we clean up.', blogId: chipotleCorporateBlog.$id }),
    Blog.insert({ name: 'Burrito Management, a new paradigm.', blogId: chipotleCorporateBlog.$id }),
    Blog.insert({ name: 'Salads are great, the post.', blogId: choppedBlog.$id }),
    Blog.insert({ name: 'Guacamole Greens to the rescue!.', blogId: choppedBlog.$id }),
    Blog.insert({ name: 'Lentils are great', blogId: cavaBlog.$id })
  ]);


  /**
   *  Comment
   */
  await Promise.all([
    // comment with no post id but organizationId which links to higher
    Comment.insert({
      text: 'TEST_COMMENT',
      blogId: chipotleCorporateBlog.$id
    })
  ]);


  /**
    Teams
   */
  const [
    burritoMakers,
    chipotleMarketing,
    cavaEngineers
  ] = await Promise.all([
    Team.insert({ name: 'burritoMakers', organizationId: chipotle.$id }),
    Team.insert({ name: 'chipotleMarketing', organizationId: chipotle.$id }),
    Team.insert({ name: 'cavaEngineers', organizationId: cava.$id })
  ]);

  await Team.insert({ name: 'choppedExec', organizationId: chopped.$id });

  /**
    Users
   */
  const [
    ben,
    ted
  ] = await Promise.all([

    User.insert({
      name: 'ben',
      organizationId: chipotle.$id,
      teamIds: [
        burritoMakers.$id,
        chipotleMarketing.$id
      ]
    }),

    User.insert({
      name: 'ted',
      organizationId: cava.$id,
      teamIds: [
        cavaEngineers.$id
      ]
    }),

    User.insert({
      name: 'noTeams',
      organizationId: chipotle.$id
    })

  ]);

  await Promise.all([
    Chart.insert({
      name: 'test1',
      blogId: cavaBlog.$id,
      organizationId: cava.$id,
      userIds: [ ben.$id, ted.$id ]
    })
  ]);

}
