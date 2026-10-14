import { beforeEach, describe, expect, it, vi } from 'vitest';
import { User } from '../../types';

const invokeMock = vi.fn();
const getSessionMock = vi.fn();

vi.mock('../../lib/supabaseClient', () => ({
  default: {
    auth: { getSession: getSessionMock },
    functions: { invoke: invokeMock },
  },
}));

describe('user Auth management service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionMock.mockResolvedValue({ data: { session: { access_token: 'test-access-token' } }, error: null });
    invokeMock.mockResolvedValue({ data: { success: true }, error: null });
  });

  it('creates Auth-backed users through the Admin Edge Function', async () => {
    const user: User = {
      id: 'auth-user-1',
      email: 'member@example.com',
      password: '',
      fullName: 'New Member',
      role: 'Member' as const,
      permissions: [] as User['permissions'],
    };
    invokeMock.mockResolvedValueOnce({ data: { user }, error: null });
    const { createUser } = await import('../users');
    const input = {
      email: user.email,
      password: 'initial-secret',
      fullName: user.fullName,
      role: user.role,
      permissions: user.permissions,
    };

    await expect(createUser(input)).resolves.toEqual(user);
    expect(invokeMock).toHaveBeenCalledWith('admin-users', {
      headers: { Authorization: 'Bearer test-access-token' },
      body: {
        action: 'create',
        email: user.email,
        password: 'initial-secret',
        fullName: user.fullName,
        role: user.role,
        permissions: user.permissions,
      },
    });
  });

  it('updates a Supabase Auth password and user profile through the Admin Edge Function', async () => {
    const { updateUser } = await import('../users');

    const user = {
      id: 'user-1',
      email: 'member@example.com',
      password: '',
      fullName: 'Updated Member',
      role: 'Member' as const,
      permissions: [] as User['permissions'],
    };
    invokeMock.mockResolvedValueOnce({ data: { user }, error: null });
    await expect(updateUser('user-1', {
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      permissions: user.permissions,
      password: 'new-secret',
    })).resolves.toEqual(user);
    expect(invokeMock).toHaveBeenCalledWith('admin-users', {
      headers: { Authorization: 'Bearer test-access-token' },
      body: {
        action: 'update',
        targetUserId: 'user-1',
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        permissions: user.permissions,
        password: 'new-secret',
      },
    });
  });

  it('deletes Auth-backed users through the Admin Edge Function', async () => {
    const { deleteUser } = await import('../users');

    await expect(deleteUser('user-1')).resolves.toBeUndefined();
    expect(invokeMock).toHaveBeenCalledWith('admin-users', {
      headers: { Authorization: 'Bearer test-access-token' },
      body: { action: 'delete', targetUserId: 'user-1' },
    });
  });

  it('does not invoke the Admin Edge Function without a Supabase session', async () => {
    getSessionMock.mockResolvedValueOnce({ data: { session: null }, error: null });
    const { createUser } = await import('../users');

    await expect(createUser({
      email: 'member@example.com',
      password: 'initial-secret',
      fullName: 'New Member',
      role: 'Member',
      permissions: [],
    })).rejects.toThrow('Sesi Supabase tidak ditemukan. Silakan login ulang, lalu coba lagi.');
    expect(invokeMock).not.toHaveBeenCalled();
  });
});
