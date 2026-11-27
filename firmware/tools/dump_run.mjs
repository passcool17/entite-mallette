// node tools/dump_run.mjs N : résumé JSON de makeRun(seed) pour les graines 1..N et quelques grandes (référence web)
import { makeRun, wallSwap } from '../../js/game.js';
const N = +process.argv[2] || 300, out = [];
const seeds = [...Array(N).keys()].map((i) => i + 1).concat([0xdeadbeef, 123456789, 4294967295, 2654435761]);
for (const s of seeds) {
  const r = makeRun(s);
  const req = (p) => [0, 1, 2, 3, 4].map((c) => (c in p.req ? (p.req[c] == null ? -1 : p.req[c]) : -2));
  const mz = (m) => m.walls.flat().join(',') + '/' + m.path.join(',');
  const sw = r.swap5 ? `${r.swap5.close.x},${r.swap5.close.y},${r.swap5.close.d}>${r.swap5.open.x},${r.swap5.open.y},${r.swap5.open.d}` : '-';
  out.push([s >>> 0, r.sig, r.serial, r.lot, r.word1, r.scramble, r.bar.join(','), r.trapColors.join(','), r.trap, r.simon.seq.join(''),
    r.wires.join(','), req(r.patch1).join(','), r.patch1.cues.join(' '), req(r.patch2).join(','), r.patch2.cues.join(' '), mz(r.maze1), mz(r.maze2), sw,
    r.frags.join(''), r.code1, r.code2, r.keyOrder.join(''), r.lies.fragLies.join(''), `${r.decoys.wire1.cable}${r.decoys.wire1.socket}${r.decoys.wire2.cable}${r.decoys.wire2.socket}`,
    r.decoys.frags.join(''), r.word, r.enc2.join(','), r.cues[8].join(' '), r.decoys.word].join(' | '));
}
console.log(out.join('\n'));
