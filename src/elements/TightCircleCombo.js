import { CircleCombo } from '@antv/g6';

/**
 * Custom Circle Combo that calculates tighter bounds
 * Applies a 0.707 multiplier (1/sqrt(2)) to account for the difference
 * between a bounding box and the circle that contains it
 */
export class TightCircleCombo extends CircleCombo {
  
  /**
   * Override getExpandedKeySize to apply tighter bounds
   */
  getExpandedKeySize(attributes) {
    const contentBBox = this.getContentBBox(attributes);
    const [width, height] = [this.getBBoxWidth(contentBBox), this.getBBoxHeight(contentBBox)];
    
    // Apply the 0.707 multiplier to get a tighter circle
    // This accounts for the difference between a square bounding box and its inscribed circle
    // let tightWidth = width *  1.1;
    // let tightHeight = height *  1.1;
    // let tightWidth = width * 0.707;
    // let tightHeight = height * 0.707;
    let tightWidth = width;
    let tightHeight = height;
    
    // Ensure we don't get negative or zero sizes
    const minSize = 20; // Minimum combo size
    tightWidth = Math.max(tightWidth, minSize);
    tightHeight = Math.max(tightHeight, minSize);
    
    console.log(`TightCircleCombo ${attributes.id}: Original size (${width.toFixed(1)}, ${height.toFixed(1)}) -> Tight size (${tightWidth.toFixed(1)}, ${tightHeight.toFixed(1)})`);
    
    return [tightWidth, tightHeight, 0];
  }
  
  /**
   * Helper method to get bbox width
   */
  getBBoxWidth(bbox) {
    if (bbox.max && bbox.min) {
      return bbox.max[0] - bbox.min[0];
    }
    // Fallback for different bbox formats
    return bbox.halfExtents ? bbox.halfExtents[0] * 2 : 100;
  }
  
  /**
   * Helper method to get bbox height
   */
  getBBoxHeight(bbox) {
    if (bbox.max && bbox.min) {
      return bbox.max[1] - bbox.min[1];
    }
    // Fallback for different bbox formats
    return bbox.halfExtents ? bbox.halfExtents[1] * 2 : 100;
  }
}