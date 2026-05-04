import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { AuthService } from '../services/auth';

export const AdminUserManagementScreen: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setFetching(true);
    const userList = await AuthService.getAllUsers();
    setUsers(userList);
    setFetching(false);
  };

  const filteredUsers = users.filter(user => {
    const name = (user.username || user.phoneNumber || '').toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  const handleCreateOrUpdateUser = async () => {
    if (newUserPhone.length < 3) {
      Alert.alert('Error', 'Please enter a valid username or phone number');
      return;
    }
    setLoading(true);
    try {
      await AuthService.createUserByAdmin(newUserPhone, newUserPassword, role);
      Alert.alert('Success', editingUserId ? 'User updated successfully!' : 'User created successfully!');
      resetForm();
      loadUsers();
    } catch (e) {
      Alert.alert('Error', 'Operation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectUser = (user: any) => {
    setEditingUserId(user.id);
    setNewUserPhone(user.phoneNumber || user.username || '');
    setNewUserPassword(user.password || '');
    setRole(user.role === 'admin' ? 'admin' : 'user');
  };

  const resetForm = () => {
    setEditingUserId(null);
    setNewUserPhone('');
    setNewUserPassword('');
    setRole('user');
  };

  return (
    <View style={styles.container}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        <Text style={styles.headerTitle}>User Management</Text>
        <View style={styles.section}>
          <Text style={styles.sectionSubtitle}>
            {editingUserId ? 'Edit User' : 'Create New User'}
          </Text>
          <TextInput
            style={[styles.input, editingUserId && styles.disabledInput]}
            placeholder="Username or Phone Number"
            value={newUserPhone}
            onChangeText={setNewUserPhone}
            editable={!editingUserId}
            placeholderTextColor="#000"
          />
          <TextInput
            style={styles.input}
            placeholder="User Password"
            value={newUserPassword}
            onChangeText={setNewUserPassword}
            secureTextEntry={false}
            placeholderTextColor="#000"
          />
          
          <View style={styles.roleContainer}>
            <Text style={styles.roleLabel}>Select Profile:</Text>
            <View style={styles.roleButtons}>
              <TouchableOpacity 
                style={[styles.roleButton, role === 'user' && styles.roleButtonActive]} 
                onPress={() => setRole('user')}
              >
                <Text style={[styles.roleButtonText, role === 'user' && styles.roleButtonTextActive]}>User</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.roleButton, role === 'admin' && styles.roleButtonActive]} 
                onPress={() => setRole('admin')}
              >
                <Text style={[styles.roleButtonText, role === 'admin' && styles.roleButtonTextActive]}>Admin</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.formActions}>
            <TouchableOpacity 
              style={[styles.button, { flex: 2 }]} 
              onPress={handleCreateOrUpdateUser} 
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Processing...' : (editingUserId ? 'Update User' : 'Create User')}
              </Text>
            </TouchableOpacity>
            {editingUserId && (
              <TouchableOpacity 
                style={[styles.button, styles.cancelButton, { flex: 1 }]} 
                onPress={resetForm}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.listSection}>
          <Text style={styles.listTitle}>Existing Users</Text>
          
          <TextInput
            style={styles.searchInput}
            placeholder="Search users..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#000"
          />

          {fetching ? (
            <ActivityIndicator size="small" color="#007AFF" />
          ) : (
            filteredUsers.length > 0 ? (
              filteredUsers.map((user) => (
                <TouchableOpacity 
                  key={user.id} 
                  style={styles.userItem}
                  onPress={() => handleSelectUser(user)}
                >
                  <View>
                    <Text style={styles.userName}>{user.username || user.phoneNumber}</Text>
                    <Text style={styles.userRole}>{user.role}</Text>
                  </View>
                  <Text style={styles.editLink}>Edit</Text>
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.emptyText}>No users found.</Text>
            )
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 20 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, color: '#333' },
  section: { backgroundColor: '#fff', borderRadius: 12, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3, marginBottom: 24 },
  sectionSubtitle: { fontSize: 18, fontWeight: '600', marginBottom: 16, color: '#007AFF' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 12, backgroundColor: '#fafafa', color: '#000' },
  disabledInput: { backgroundColor: '#eee', color: '#666' },
  roleContainer: { marginBottom: 20 },
  roleLabel: { fontSize: 16, fontWeight: '600', marginBottom: 8, color: '#333' },
  roleButtons: { flexDirection: 'row', gap: 10 },
  roleButton: { flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#007AFF', alignItems: 'center' },
  roleButtonActive: { backgroundColor: '#007AFF' },
  roleButtonText: { color: '#007AFF', fontWeight: '600', fontSize: 16 },
  roleButtonTextActive: { color: '#fff' },
  formActions: { flexDirection: 'row', gap: 10 },
  button: { backgroundColor: '#34C759', padding: 14, borderRadius: 8, alignItems: 'center' },
  cancelButton: { backgroundColor: '#FF9500' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  listSection: { marginTop: 10 },
  listTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 12, color: '#333' },
  userItem: { backgroundColor: '#fff', padding: 15, borderRadius: 10, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  userName: { fontSize: 16, fontWeight: '600', color: '#333' },
  userRole: { fontSize: 14, color: '#666', textTransform: 'capitalize' },
  editLink: { color: '#007AFF', fontWeight: '600' },
  searchInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 16, color: '#000' },
  emptyText: { textAlign: 'center', color: '#666', marginTop: 20, fontSize: 16 },
});
