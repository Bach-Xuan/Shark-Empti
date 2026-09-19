import { getAdminDb } from '@/lib/firebase-admin';
import { deleteForumPostTree } from '@/lib/forum-deletion';
import { apiFailure, authenticatedUser } from '@/lib/server-api';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ postId: string }> }) {
  try {
    const uid = await authenticatedUser(request);
    await deleteForumPostTree(getAdminDb(), (await params).postId, uid);
    return NextResponse.json({ ok: true });
  } catch (error) { return apiFailure(error); }
}
