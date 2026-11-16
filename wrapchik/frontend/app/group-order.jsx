import React, { useContext, useState } from 'react';
import { View, StyleSheet, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import Header from '../components/common/Header';
import Button from '../components/common/Button';
import groupService from '../services/groupService';
import { AuthContext } from '../context/AuthContext';
import COLORS from '../constants/colors';

export default function GroupOrderScreen() {
  const router = useRouter();
  const { user } = useContext(AuthContext);
  const [tab, setTab] = useState('CREATE'); // CREATE, JOIN, LOBBY
  const [groupCode, setGroupCode] = useState('');
  const [orderType, setOrderType] = useState('TAKEAWAY'); // TAKEAWAY, DELIVERY
  const [hostel, setHostel] = useState('');
  const [maxMembers, setMaxMembers] = useState('5');
  const [groupDetails, setGroupDetails] = useState(null);

  const handleCreateGroup = async () => {
    try {
      const data = { orderType, maxMembers: parseInt(maxMembers) };
      if (orderType === 'DELIVERY') data.hostel = hostel;
      const res = await groupService.createGroup(data);
      if (res.success) {
        setGroupDetails(res.group);
        setTab('LOBBY');
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to create group');
    }
  };

  const handleJoinGroup = async () => {
    try {
      const res = await groupService.joinGroup(groupCode);
      if (res.success) {
        setGroupDetails(res.group);
        setTab('LOBBY');
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to join group');
    }
  };

  const handleLockGroup = async () => {
    try {
      const res = await groupService.lockGroup(groupDetails._id);
      if (res.success) {
        setGroupDetails({ ...groupDetails, status: 'LOCKED' });
        Alert.alert('Success', 'Group Locked. Members can now proceed to checkout.');
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to lock group');
    }
  };

  const handleLeaveGroup = async () => {
    try {
      await groupService.leaveGroup(groupDetails._id);
      setGroupDetails(null);
      setTab('CREATE');
    } catch (e) {
      Alert.alert('Error', 'Failed to leave group');
    }
  };

  return (
    <View style={styles.container}>
      <Header title="Group Order" showBack showCart={false} />

      {tab !== 'LOBBY' && (
        <View style={styles.tabContainer}>
          <TouchableOpacity onPress={() => setTab('CREATE')} style={[styles.tab, tab === 'CREATE' && styles.activeTab]}>
            <Text style={[styles.tabText, tab === 'CREATE' && styles.activeTabText]}>Create Group</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setTab('JOIN')} style={[styles.tab, tab === 'JOIN' && styles.activeTab]}>
            <Text style={[styles.tabText, tab === 'JOIN' && styles.activeTabText]}>Join Group</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.content}>
        {tab === 'CREATE' && (
          <View>
            <Text style={styles.label}>Order Type</Text>
            <View style={styles.radioGroup}>
              <TouchableOpacity onPress={() => setOrderType('TAKEAWAY')} style={[styles.radioBtn, orderType === 'TAKEAWAY' && styles.activeRadio]}>
                <Text style={orderType === 'TAKEAWAY' ? styles.activeTabText : styles.tabText}>Takeaway</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setOrderType('DELIVERY')} style={[styles.radioBtn, orderType === 'DELIVERY' && styles.activeRadio]}>
                <Text style={orderType === 'DELIVERY' ? styles.activeTabText : styles.tabText}>Delivery</Text>
              </TouchableOpacity>
            </View>

            {orderType === 'DELIVERY' && (
              <>
                <Text style={styles.label}>Hostel / Location</Text>
                <TextInput style={styles.input} value={hostel} onChangeText={setHostel} placeholder="e.g. Hostel A" />
              </>
            )}

            <Text style={styles.label}>Max Members</Text>
            <TextInput style={styles.input} value={maxMembers} onChangeText={setMaxMembers} keyboardType="numeric" />

            <Button title="Create Group" onPress={handleCreateGroup} style={{ marginTop: 20 }} />
          </View>
        )}

        {tab === 'JOIN' && (
          <View>
            <Text style={styles.label}>Group Code</Text>
            <TextInput style={styles.input} value={groupCode} onChangeText={setGroupCode} placeholder="Enter Code" />
            <Button title="Join Group" onPress={handleJoinGroup} style={{ marginTop: 20 }} />
          </View>
        )}

        {tab === 'LOBBY' && groupDetails && (
          <View>
            <Text style={styles.lobbyTitle}>Group Lobby</Text>
            <Text style={styles.codeText}>Code: {groupDetails.groupCode}</Text>
            <Text style={styles.statusText}>Status: {groupDetails.status}</Text>

            <Text style={styles.label}>Members</Text>
            {groupDetails.members?.map((m, i) => (
              <Text key={i} style={styles.memberText}>- {m.name || m.userId?.name || 'Member'}</Text>
            ))}

            {String(groupDetails.leaderId?._id || groupDetails.leaderId) === String(user?._id) && groupDetails.status === 'OPEN' && (
              <Button title="Lock Group" onPress={handleLockGroup} style={{ marginTop: 20 }} />
            )}

            <Button title="Leave Group" onPress={handleLeaveGroup} style={{ marginTop: 10, backgroundColor: COLORS.danger }} />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  tabContainer: { flexDirection: 'row', padding: 16 },
  tab: { flex: 1, padding: 12, alignItems: 'center', borderBottomWidth: 2, borderColor: 'transparent' },
  activeTab: { borderColor: COLORS.primary },
  tabText: { color: COLORS.textSecondary, fontWeight: 'bold' },
  activeTabText: { color: COLORS.primary, fontWeight: 'bold' },
  content: { padding: 16 },
  label: { fontWeight: 'bold', marginBottom: 8, marginTop: 12 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 12, backgroundColor: '#fff' },
  radioGroup: { flexDirection: 'row', gap: 10 },
  radioBtn: { flex: 1, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: 8 },
  activeRadio: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  lobbyTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 12 },
  codeText: { fontSize: 32, fontWeight: 'bold', color: COLORS.primary, textAlign: 'center', marginVertical: 16 },
  statusText: { fontSize: 16, marginBottom: 12 },
  memberText: { fontSize: 16, marginBottom: 4 }
});
