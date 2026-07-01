/**
 * Notifications API Route
 * GET /api/v1/notifications - List notifications
 * PUT /api/v1/notifications - Mark as read
 */

import { NextRequest } from 'next/server';
import { successResponse, badRequest, serverError } from '@/lib/api/response';
import { apiRequest, getAuthToken } from '@/lib/api/database';
import { authenticate } from '@/lib/api/auth';
import type { Notification } from '@/lib/api/types';

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const user = await authenticate(request);
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const unreadOnly = searchParams.get('unread') === 'true';

    const query = new URLSearchParams({ 
      page: page.toString(), 
      limit: limit.toString(),
      userId: user.id 
    });
    if (unreadOnly) query.set('unread', 'true');

    const result = await apiRequest<{ data: Notification[]; total: number }>(
      `/api/v1/notifications?${query}`,
      { headers: { Authorization: `Bearer ${await getAuthToken(request)}` } }
    );

    return successResponse(result);
  } catch (error) {
    console.error('Notifications error:', error);
    return serverError('Failed to fetch notifications');
  }
}

export async function PUT(request: NextRequest): Promise<Response> {
  try {
    const user = await authenticate(request);
    const body = await request.json();
    const { notificationIds, markAllRead } = body;

    if (!notificationIds && !markAllRead) {
      return badRequest('Provide notificationIds or markAllRead: true');
    }

    const result = await apiRequest<{ updated: number }>('/notifications', {
      method: 'PUT',
      body: { userId: user.id, notificationIds, markAllRead },
      headers: { Authorization: `Bearer ${await getAuthToken(request)}` },
    });

    return successResponse(result);
  } catch (error) {
    console.error('Update notifications error:', error);
    return serverError('Failed to update notifications');
  }
}