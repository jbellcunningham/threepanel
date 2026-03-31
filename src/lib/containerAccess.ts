/**
 * FILE: /src/lib/containerAccess.ts
 *
 * PURPOSE:
 * - Centralizes container access logic
 * - Used by:
 *   - reporting routes
 *   - export routes
 *   - future sharing features
 *
 * DESIGN:
 * - Owner (userId === container.userId) always has full access
 * - Additional access granted via ContainerAccess rows
 * - Keeps all permission logic in one place
 */

/* =========================================================
   1) Imports
   ========================================================= */

import { prisma } from '@/lib/prisma'

/* =========================================================
   2) Core Access Checks
   ========================================================= */

/**
 * Determines whether a user can read a specific container.
 */
export async function canReadContainer(
  userId: string,
  trackerItemId: string
): Promise<boolean> {
  // Owner always has access
  const owner = await prisma.trackerItem.findFirst({
    where: {
      id: trackerItemId,
      userId,
    },
    select: { id: true },
  })

  if (owner) {
    return true
  }

  // Check shared access
  const access = await prisma.containerAccess.findFirst({
    where: {
      userId,
      trackerItemId,
      accessType: 'read',
    },
    select: { id: true },
  })

  return Boolean(access)
}

/**
 * Returns all container IDs a user can read.
 */
export async function getReadableContainerIds(
  userId: string
): Promise<string[]> {
  // Containers owned by user
  const owned = await prisma.trackerItem.findMany({
    where: { userId },
    select: { id: true },
  })

  // Containers shared with user
  const shared = await prisma.containerAccess.findMany({
    where: {
      userId,
      accessType: 'read',
    },
    select: {
      trackerItemId: true,
    },
  })

  const ids = new Set<string>()

  owned.forEach((item) => ids.add(item.id))
  shared.forEach((item) => ids.add(item.trackerItemId))

  return Array.from(ids)
}

/**
 * Loads containers a user can read.
 * Useful for reporting list views.
 */
export async function getReadableContainers(userId: string) {
  const ids = await getReadableContainerIds(userId)

  if (ids.length === 0) {
    return []
  }

  return prisma.trackerItem.findMany({
    where: {
      id: { in: ids },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })
}
