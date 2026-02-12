/**
 * Table Position Utilities
 * Calculates agent positions for the Round Table Collaboration feature
 */

export interface Position {
  x: number; // percentage from left
  y: number; // percentage from top
  facing?: 'left' | 'right' | 'inward';
}

export interface TableConfig {
  centerX: number;    // % from left
  centerY: number;    // % from top
  radiusPx: number;   // pixels
}

const DEFAULT_TABLE_CONFIG: TableConfig = {
  centerX: 50,
  centerY: 57,
  radiusPx: 200,
};

/**
 * Calculate position around the table for a given agent index
 * @param agentIndex - 0-based index of agent in participant list
 * @param totalAgents - Total number of agents at table
 * @param config - Table configuration (optional)
 * @param containerWidth - Container width in pixels (for % calculation)
 * @param containerHeight - Container height in pixels (for % calculation)
 */
export const getTablePosition = (
  agentIndex: number,
  totalAgents: number,
  config: TableConfig = DEFAULT_TABLE_CONFIG,
  containerWidth = 1200,
  containerHeight = 750
): Position => {
  // Start at top (12 o'clock) and go clockwise
  const angleOffset = -Math.PI / 2; // Start at top
  const angle = angleOffset + (agentIndex / totalAgents) * 2 * Math.PI;

  // Calculate position in pixels
  const xPx = config.radiusPx * Math.cos(angle);
  const yPx = config.radiusPx * Math.sin(angle);

  // Convert to percentages relative to container
  const xPercent = config.centerX + (xPx / containerWidth) * 100;
  const yPercent = config.centerY + (yPx / containerHeight) * 100;

  return {
    x: xPercent,
    y: yPercent,
    facing: 'inward',
  };
};

/**
 * Calculate all table positions for a group of agents
 */
export const getAllTablePositions = (
  agentIds: string[],
  config?: TableConfig,
  containerWidth?: number,
  containerHeight?: number
): Record<string, Position> => {
  const positions: Record<string, Position> = {};
  
  agentIds.forEach((agentId, index) => {
    positions[agentId] = getTablePosition(
      index,
      agentIds.length,
      config,
      containerWidth,
      containerHeight
    );
  });

  return positions;
};

/**
 * Get the standard desk position for an agent by index
 */
export const getDeskPosition = (agentIndex: number): Position => {
  const DESK_POSITIONS: Position[] = [
    { x: 22, y: 42, facing: 'right' },
    { x: 58, y: 42, facing: 'left' },
    { x: 22, y: 72, facing: 'right' },
    { x: 58, y: 72, facing: 'left' },
    { x: 40, y: 26, facing: 'right' },
    { x: 40, y: 86, facing: 'left' },
  ];

  // Cycle through positions if more agents than desks
  return DESK_POSITIONS[agentIndex % DESK_POSITIONS.length];
};

/**
 * Calculate animation delay for staggered entrance
 * @param agentIndex - Index in the agent list
 * @param delayMs - Delay between each agent (default 150ms)
 */
export const getStaggerDelay = (
  agentIndex: number,
  delayMs = 150
): number => {
  return agentIndex * delayMs;
};

/**
 * Calculate animation delay for staggered exit (reverse order)
 */
export const getExitStaggerDelay = (
  agentIndex: number,
  totalAgents: number,
  delayMs = 150
): number => {
  return (totalAgents - 1 - agentIndex) * delayMs;
};
