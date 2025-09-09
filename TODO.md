# APP VIEW
## Custom Rewrite
* [x] d3 packing static | Sat, September 6
* [x] move nodes w/ edges | Sat, September 6
* [x] basic app view
* [x] reset button | Sat, September 6
* [x] move groupings | Sat, September 6
* [x] remove pin nodes | Sat, September 6
* [x] z index edges | Sat, September 6
* [x] padding | Sat, September 6
* [x] center/zoom on load | Sat, September 6
* [x] remove other cruft | Sat, September 6
* [x] fix labels /white? | Mon, September 8
* [x] use icons | Mon, September 8
* [x] better lines | Mon, September 8
* [x] arrow heads | Mon, September 8
* [x] refactor graphRenderer.js | Mon, September 8
* [x] remove g6test.vue and button switcher | Mon, September 8
* [x] fix node size | Mon, September 8
* [x] detail view | Mon, September 8
* [x] edges - render on drag | Mon, September 8
* [x] highlight | Tues, September 9
* [x] highlight on drag | Tues, September 9
* [ ] filters
* [ ] reset button broken
* [ ] bug: edge calculation in-out?
* [ ] getEdgeSegmentsForUpdate unused?

## Bonus Features
* [ ] collapse expand groups
* [ ] leaf nodes offset for label collision
* [ ] position root leafs radially
* [ ] data impedence mismatch d.data.data
* [ ] re-install package.json removing g6
* [ ] node labels offset -y

## Not sure
* [x] sub-connections missing in app view
* [x] node details: components sections (sub graph?)
* [ ] subgraph, circle packing?

# BUGS
* [ ] App View: highlighting broken
* [x] Graph Pane (Highlight) - enlargement is only working sometimes during 'click to highlight from node details' - not during click on graph pane
* [x] Graph Pane (Highlight) - node detail labels do not follow dragged node
* [ ] Graph Pane (Reordering) - Dragging a node, all the connected nodes follow. We want to drag it away and not have them follow so aggresively  (Only happens with few nodes)
###########

# ARCHIVE #
###########

### 0.1.1
* [x] Node Details: "Last Profiled"