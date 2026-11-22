import test from 'node:test';
import assert from 'node:assert/strict';
import { ENEMY_ART, TOWER, TOWER_SMALL } from '../art.js';
import { PIXEL_ENEMIES, PIXEL_TONES, pixelSpire } from '../pixel-art.js';

const width = rows => Math.max(...rows.map(row => row.length));
const valid = new RegExp(`^[.b${PIXEL_TONES}]+$`);

// Pixel sprites are painted into the ASCII sprite's box, so a swap keeps every
// unit in place. Their grids must keep about square pixels in that box.
function assertFits(name, grid, ascii) {
  assert.ok(grid.length > 0, name + ' has rows');
  const columns = grid[0].length;
  for (const row of grid) {
    assert.equal(row.length, columns, name + ' rows are the same width');
    assert.match(row, valid, name + ' uses known tones');
  }
  const pixelWidth = width(ascii) * .624 / columns;
  const pixelHeight = ascii.length / grid.length;
  assert.ok(Math.abs(pixelWidth / pixelHeight - 1) < .12, `${name} pixels are square (${(pixelWidth / pixelHeight).toFixed(2)})`);
}

test('every enemy has a pixel sprite that fits its ASCII box', () => {
  assert.deepEqual(Object.keys(PIXEL_ENEMIES).sort(), Object.keys(ENEMY_ART).sort());
  for (const [key, ascii] of Object.entries(ENEMY_ART)) assertFits(key, PIXEL_ENEMIES[key], ascii);
});

test('the pixel Spire fills both ASCII Spire boxes', () => {
  for (const [name, ascii] of [['large', TOWER], ['small', TOWER_SMALL]]) {
    const grid = pixelSpire(width(ascii), ascii.length);
    assertFits('spire ' + name, grid, ascii);
    // The core sits in the middle, like the @@@ in the ASCII Spire.
    const middle = grid[Math.floor(grid.length / 2)];
    assert.match(middle[Math.floor(middle.length / 2)], /[agh]/, name + ' core is lit');
  }
});

test('every enemy has a vector drawing in its ASCII box', async () => {
  const { VECTOR_ENEMIES, vectorSpire } = await import('../vector-art.js');
  for (const [key, ascii] of Object.entries(ENEMY_ART)) {
    const drawing = VECTOR_ENEMIES[key];
    assert.ok(drawing, key + ' has a vector drawing');
    assert.ok(Math.abs(drawing.w - width(ascii) * 6.24) < 1e-6 && drawing.h === ascii.length * 10, key + ' uses the ASCII box');
    for (const shape of drawing.shapes) {
      assert.ok(shape.fill || shape.stroke, key + ' shapes are painted');
      assert.ok(!/NaN|undefined/.test(shape.d), key + ' paths are valid');
    }
  }
  const spire = vectorSpire(width(TOWER), TOWER.length);
  assert.equal(spire.h, TOWER.length * 10);
});
