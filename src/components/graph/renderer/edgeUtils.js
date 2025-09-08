/**
 * edgeUtils.js - Geometry and edge styling utilities for GraphRenderer
 * 
 * Contains mathematical utilities for 2D geometry operations and advanced edge styling
 * used in network graph visualization. Includes line-circle intersections, point containment,
 * and gradient generation for sophisticated edge styling.
 */

export class EdgeUtils {
  /**
   * Calculate edge segments with flexible group filtering
   * Consolidated function to replace multiple duplicate segment calculators
   * @param {Object} edge - Edge with source and target
   * @param {Map} positionMap - Map of node positions
   * @param {Array} groups - Array of group circles to check intersections
   * @param {Function} filterFn - Optional filter function to determine styling
   * @returns {Array} Array of segments with styling information
   */
  static calculateEdgeSegments(edge, positionMap, groups, filterFn = null) {
    const sourcePos = positionMap.get(edge.source);
    const targetPos = positionMap.get(edge.target);
    
    if (!sourcePos || !targetPos) return [];
    
    // Start with the full edge as one segment
    const points = [
      { t: 0, x: sourcePos.x, y: sourcePos.y },
      { t: 1, x: targetPos.x, y: targetPos.y }
    ];
    
    // Find all intersection points with groups
    for (const group of groups) {
      const intersections = this.getLineCircleIntersections(sourcePos, targetPos, group);
      
      for (const intersection of intersections) {
        points.push({
          t: intersection.t,
          x: intersection.x,
          y: intersection.y
        });
      }
    }
    
    // Sort points by parameter t
    points.sort((a, b) => a.t - b.t);
    
    // Remove duplicates (very close points)
    const uniquePoints = [];
    for (const point of points) {
      if (uniquePoints.length === 0 || Math.abs(point.t - uniquePoints[uniquePoints.length - 1].t) > 0.001) {
        uniquePoints.push(point);
      }
    }
    
    // Create segments and determine styling
    const segments = [];
    for (let i = 0; i < uniquePoints.length - 1; i++) {
      const start = uniquePoints[i];
      const end = uniquePoints[i + 1];
      
      // Check midpoint to determine if segment should be styled as unrelated
      const midT = (start.t + end.t) / 2;
      const midX = sourcePos.x + midT * (targetPos.x - sourcePos.x);
      const midY = sourcePos.y + midT * (targetPos.y - sourcePos.y);
      
      // Use filter function if provided, otherwise default to false
      const insideUnrelatedGroup = filterFn ? filterFn({ x: midX, y: midY }, groups) : false;
      
      segments.push({
        x1: start.x,
        y1: start.y,
        x2: end.x,
        y2: end.y,
        insideUnrelatedGroup: insideUnrelatedGroup
      });
    }
    
    return segments;
  }

  /**
   * Convert segment data to SVG gradient stops
   * Creates percentage-based gradient stops for smooth color transitions
   * @param {Array} segments - Array of segments with styling information
   * @returns {Array} Array of gradient stops
   */
  static segmentsToGradientStops(segments) {
    if (segments.length === 0) return [];
    
    const stops = [];
    let currentOffset = 0;
    
    // Calculate total length for percentage calculation
    let totalLength = 0;
    segments.forEach(segment => {
      const dx = segment.x2 - segment.x1;
      const dy = segment.y2 - segment.y1;
      totalLength += Math.sqrt(dx * dx + dy * dy);
    });
    
    segments.forEach((segment, index) => {
      const dx = segment.x2 - segment.x1;
      const dy = segment.y2 - segment.y1;
      const segmentLength = Math.sqrt(dx * dx + dy * dy);
      const segmentPercent = (segmentLength / totalLength) * 100;
      
      // Add stop at start of segment
      const startPercent = currentOffset;
      const endPercent = currentOffset + segmentPercent;
      
      if (segment.insideUnrelatedGroup) {
        // Light styling for unrelated segments
        stops.push({
          offset: `${startPercent}%`,
          color: '#ccc',
          opacity: 0.2
        });
        stops.push({
          offset: `${endPercent}%`,
          color: '#ccc', 
          opacity: 0.2
        });
      } else {
        // Solid styling for related segments
        stops.push({
          offset: `${startPercent}%`,
          color: '#888',
          opacity: 0.4
        });
        stops.push({
          offset: `${endPercent}%`,
          color: '#888',
          opacity: 0.4
        });
      }
      
      currentOffset = endPercent;
    });
    
    return stops;
  }

  /**
   * Get all intersection points between a line segment and a circle
   * @param {Object} p1 - Start point {x, y}
   * @param {Object} p2 - End point {x, y}
   * @param {Object} circle - Circle {x, y, r}
   * @returns {Array} Array of intersection points with parameter t
   */
  static getLineCircleIntersections(p1, p2, circle) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const fx = p1.x - circle.x;
    const fy = p1.y - circle.y;
    
    const a = dx * dx + dy * dy;
    const b = 2 * (fx * dx + fy * dy);
    const c = (fx * fx + fy * fy) - circle.r * circle.r;
    
    const discriminant = b * b - 4 * a * c;
    
    if (discriminant < 0) return []; // No intersection
    
    const intersections = [];
    const sqrt_discriminant = Math.sqrt(discriminant);
    
    // Check both intersection points
    const t1 = (-b - sqrt_discriminant) / (2 * a);
    const t2 = (-b + sqrt_discriminant) / (2 * a);
    
    if (t1 >= 0 && t1 <= 1) {
      intersections.push({
        t: t1,
        x: p1.x + t1 * dx,
        y: p1.y + t1 * dy
      });
    }
    
    if (t2 >= 0 && t2 <= 1 && Math.abs(t2 - t1) > 0.001) {
      intersections.push({
        t: t2,
        x: p1.x + t2 * dx,
        y: p1.y + t2 * dy
      });
    }
    
    return intersections;
  }

  /**
   * Check if a point is inside a circle
   * @param {Object} point - Point {x, y}
   * @param {Object} circle - Circle {x, y, r}
   * @returns {boolean} True if point is inside circle
   */
  static pointInCircle(point, circle) {
    const dx = point.x - circle.x;
    const dy = point.y - circle.y;
    return (dx * dx + dy * dy) <= (circle.r * circle.r);
  }

  /**
   * Check if a line segment intersects with a circle
   * @param {Object} p1 - Start point {x, y}
   * @param {Object} p2 - End point {x, y}
   * @param {Object} circle - Circle {x, y, r}
   * @returns {boolean} True if line intersects circle
   */
  static lineIntersectsCircle(p1, p2, circle) {
    // Vector from p1 to p2
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    
    // Vector from p1 to circle center
    const fx = p1.x - circle.x;
    const fy = p1.y - circle.y;
    
    // Quadratic equation coefficients for line-circle intersection
    const a = dx * dx + dy * dy;
    const b = 2 * (fx * dx + fy * dy);
    const c = (fx * fx + fy * fy) - circle.r * circle.r;
    
    const discriminant = b * b - 4 * a * c;
    
    if (discriminant < 0) return false; // No intersection
    
    // Check if intersection points are within the line segment
    const sqrt_discriminant = Math.sqrt(discriminant);
    const t1 = (-b - sqrt_discriminant) / (2 * a);
    const t2 = (-b + sqrt_discriminant) / (2 * a);
    
    // Intersection occurs if either t value is between 0 and 1 (within segment)
    return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1);
  }

  /**
   * Check if an edge intersects with any group circles
   * @param {Object} edge - Edge with source and target
   * @param {Map} positionMap - Map of node positions
   * @param {Array} groupCircles - Array of circle objects
   * @returns {boolean} True if edge intersects any group
   */
  static edgeIntersectsGroups(edge, positionMap, groupCircles) {
    const sourcePos = positionMap.get(edge.source);
    const targetPos = positionMap.get(edge.target);
    
    if (!sourcePos || !targetPos) return false;
    
    // Check intersection with each group circle
    for (const circle of groupCircles) {
      // Skip if either endpoint is inside this circle (edge originates/terminates within group)
      const sourceInside = this.pointInCircle(sourcePos, circle);
      const targetInside = this.pointInCircle(targetPos, circle);
      
      if (sourceInside || targetInside) continue;
      
      // Check if line segment intersects the circle
      if (this.lineIntersectsCircle(sourcePos, targetPos, circle)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Helper to get edge segments for drag updates with simplified group detection
   * @param {Object} edge - Edge with source and target
   * @param {Object} sourcePos - Source position {x, y}
   * @param {Object} targetPos - Target position {x, y}
   * @param {Map} groupPositions - Map of group positions
   * @param {Function} pointInCircleFn - Function to check point in circle
   * @returns {Array} Array of segments
   */
  static getEdgeSegmentsForUpdate(edge, sourcePos, targetPos, groupPositions, pointInCircleFn) {
    // Simplified segment calculation for drag updates
    const applicationGroups = [];
    const clusterGroups = [];
    const homeApps = new Set();
    const homeClusters = new Set();
    
    // Build groups from current positions
    groupPositions.forEach((pos, id) => {
      if (id.startsWith('app-')) {
        applicationGroups.push({ id, x: pos.x, y: pos.y, r: pos.r });
      } else if (id.startsWith('cluster')) {
        clusterGroups.push({ id, x: pos.x, y: pos.y, r: pos.r });
      }
    });
    
    // Quick home group detection based on proximity
    for (const app of applicationGroups) {
      const sourceDist = Math.sqrt((sourcePos.x - app.x) ** 2 + (sourcePos.y - app.y) ** 2);
      const targetDist = Math.sqrt((targetPos.x - app.x) ** 2 + (targetPos.y - app.y) ** 2);
      if (sourceDist <= app.r || targetDist <= app.r) {
        homeApps.add(app.id);
      }
    }
    
    for (const cluster of clusterGroups) {
      const sourceDist = Math.sqrt((sourcePos.x - cluster.x) ** 2 + (sourcePos.y - cluster.y) ** 2);
      const targetDist = Math.sqrt((targetPos.x - cluster.x) ** 2 + (targetPos.y - cluster.y) ** 2);
      if (sourceDist <= cluster.r || targetDist <= cluster.r) {
        homeClusters.add(cluster.id);
      }
    }
    
    const positionMap = new Map();
    positionMap.set(edge.source, sourcePos);
    positionMap.set(edge.target, targetPos);
    
    // Create filter function for unrelated groups
    const isUnrelatedGroupFilter = (point, allGroups) => {
      // Check applications
      for (const appGroup of applicationGroups) {
        if (pointInCircleFn(point, appGroup)) {
          if (!homeApps.has(appGroup.id)) return true;
        }
      }
      
      // Check clusters
      for (const clusterGroup of clusterGroups) {
        if (pointInCircleFn(point, clusterGroup)) {
          if (!homeClusters.has(clusterGroup.id)) return true;
        }
      }
      
      return false;
    };
    
    return this.calculateEdgeSegments(
      edge, 
      positionMap, 
      [...applicationGroups, ...clusterGroups],
      isUnrelatedGroupFilter
    );
  }
}