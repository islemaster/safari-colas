# Safari Colas

[Play online](https://islemaster.github.io/safari-colas)

## About

Prototype of a new game by Brad and Yotam.

## Local development

1. Clone the repository
2. Install [Tweego](https://www.motoslave.net/tweego/)
3. Copy [Snowman](https://videlais.github.io/snowman/2/) 2.0.3 (included in this repo as the `storyformats/snowman-2.0.3` directory) into your Tweego install.
4. Start local test builds that will auto-rebuild on save with `--test` and `--watch`.

   ```
   npm run watch
   ```

   Open the generated main.html file in your browser to try it out. You'll have to reload your browser after you make changes to the story.
5. Run all tests with

   ```
   npm run test
   ```
   
   These tests can be a little slow. They launch a headless browser and actually play through the game in various ways. Some tests exhaustively explore the possibility space. If you want to run one test file, they can be run directly on node:

   ```
   node test/scene-exploration.js
   ```