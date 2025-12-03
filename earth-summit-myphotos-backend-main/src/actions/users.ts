'use server';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';

export type CreateUserResult = {
  success: boolean;
  userId?: string;
  error?: string;
};

export type ResetPasswordResult = {
  success: boolean;
  error?: string;
};

export type DeleteUserResult = {
  success: boolean;
  error?: string;
};

export async function createUser(formData: FormData): Promise<CreateUserResult> {
  try {
    const session = await auth();
    if (!session || session.user.role !== 'ADMIN') {
      return { success: false, error: 'Unauthorized' };
    }

    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const name = formData.get('name') as string | null;
    const role = formData.get('role') as 'USER' | 'PHOTOGRAPHER' | 'ADMIN';

    if (!email || !password) {
      return { success: false, error: 'Email and password are required' };
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return { success: false, error: 'User with this email already exists' };
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: role || 'USER',
      },
    });

    revalidatePath('/admin');
    return { success: true, userId: user.id };
  } catch (error) {
    console.error('Create user error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create user' };
  }
}

export async function resetUserPassword(userId: string, newPassword: string): Promise<ResetPasswordResult> {
  try {
    const session = await auth();
    if (!session || session.user.role !== 'ADMIN') {
      return { success: false, error: 'Unauthorized' };
    }

    if (!newPassword || newPassword.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters' };
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    revalidatePath('/admin');
    return { success: true };
  } catch (error) {
    console.error('Reset password error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to reset password' };
  }
}

export async function deleteUser(userId: string): Promise<DeleteUserResult> {
  try {
    const session = await auth();
    if (!session || session.user.role !== 'ADMIN') {
      return { success: false, error: 'Unauthorized' };
    }

    if (session.user.id === userId) {
      return { success: false, error: 'You cannot delete your own account' };
    }

    await prisma.user.delete({
      where: { id: userId },
    });

    revalidatePath('/admin');
    return { success: true };
  } catch (error) {
    console.error('Delete user error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to delete user' };
  }
}

export async function getUsers() {
  try {
    const session = await auth();
    if (!session || session.user.role !== 'ADMIN') {
      return [];
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            photos: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return users;
  } catch (error) {
    console.error('Get users error:', error);
    return [];
  }
}
