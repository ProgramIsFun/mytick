import { hasCycleInGraph } from '../src/utils/cycle';

describe('hasCycleInGraph', () => {
  it('no cycle — simple chain A→B→C', () => {
    const graph = new Map([
      ['B', ['C']],
    ]);
    expect(hasCycleInGraph('A', ['B'], graph)).toBe(false);
  });

  it('direct cycle — A→B, B→A', () => {
    const graph = new Map([
      ['B', ['A']],
    ]);
    expect(hasCycleInGraph('A', ['B'], graph)).toBe(true);
  });

  it('indirect cycle — A→B→C→A', () => {
    const graph = new Map([
      ['B', ['C']],
      ['C', ['A']],
    ]);
    expect(hasCycleInGraph('A', ['B'], graph)).toBe(true);
  });

  it('long chain no cycle — A→B→C→D→E', () => {
    const graph = new Map([
      ['B', ['C']],
      ['C', ['D']],
      ['D', ['E']],
    ]);
    expect(hasCycleInGraph('A', ['B'], graph)).toBe(false);
  });

  it('self-reference — A→A', () => {
    const graph = new Map<string, string[]>();
    expect(hasCycleInGraph('A', ['A'], graph)).toBe(true);
  });

  it('multiple blockers, one causes cycle', () => {
    const graph = new Map([
      ['C', ['A']],
    ]);
    expect(hasCycleInGraph('A', ['B', 'C'], graph)).toBe(true);
  });

  it('multiple blockers, no cycle', () => {
    const graph = new Map([
      ['B', ['D']],
      ['C', ['E']],
    ]);
    expect(hasCycleInGraph('A', ['B', 'C'], graph)).toBe(false);
  });

  it('empty blockedBy — no cycle', () => {
    const graph = new Map<string, string[]>();
    expect(hasCycleInGraph('A', [], graph)).toBe(false);
  });

  it('diamond shape no cycle — A→B, A→C, B→D, C→D', () => {
    const graph = new Map([
      ['B', ['D']],
      ['C', ['D']],
    ]);
    expect(hasCycleInGraph('A', ['B', 'C'], graph)).toBe(false);
  });

  it('diamond shape with cycle — A→B, A→C, B→D, D→A', () => {
    const graph = new Map([
      ['B', ['D']],
      ['D', ['A']],
    ]);
    expect(hasCycleInGraph('A', ['B', 'C'], graph)).toBe(true);
  });
});
