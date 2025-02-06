import React, { useState, useEffect,  } from 'react';
import { userService, User } from '../../../api/firebase/user';
import { ChevronDown } from 'lucide-react';

interface UserFilterProps {
    selectedUserId: string | null;
    onUserSelect: (userId: string | null) => void;
}
  
export const UserFilter: React.FC<UserFilterProps> = ({ selectedUserId, onUserSelect }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [users, setUsers] = useState<User[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
      const fetchUsers = async () => {
        try {
          // Replace with your actual user fetching logic
          const fetchedUsers = await userService.getAllUsers();
          setUsers(fetchedUsers);
          setLoading(false);
        } catch (error) {
          console.error('Error fetching users:', error);
          setLoading(false);
        }
      };
      
      fetchUsers();
    }, []);
  
    const filteredUsers = users.filter(user => 
      user.username.toLowerCase().includes(searchTerm.toLowerCase())
    );
  
    const selectedUser = users.find(u => u.id === selectedUserId);
  
    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full p-4 bg-zinc-800 text-white rounded-lg border border-zinc-700 flex justify-between items-center"
        >
          <span>{selectedUserId ? selectedUser?.username : 'All Users'}</span>
          <ChevronDown className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
  
        {isOpen && (
          <div className="absolute mt-2 w-full bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg z-20">
            <div className="p-2">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search users..."
                className="w-full p-2 bg-zinc-700 text-white rounded-md"
              />
            </div>
  
            <div className="max-h-60 overflow-y-auto">
              <button
                onClick={() => {
                  onUserSelect(null);
                  setIsOpen(false);
                }}
                className={`w-full p-3 text-left hover:bg-zinc-700 ${!selectedUserId ? 'bg-[#E0FE10] text-black' : 'text-white'}`}
              >
                All Users
              </button>
              
              {loading ? (
                <div className="p-3 text-zinc-400">Loading users...</div>
              ) : (
                filteredUsers.map(user => (
                  <button
                    key={user.id}
                    onClick={() => {
                      onUserSelect(user.id);
                      setIsOpen(false);
                    }}
                    className={`w-full p-3 text-left hover:bg-zinc-700 ${selectedUserId === user.id ? 'bg-[#E0FE10] text-black' : 'text-white'}`}
                  >
                    {user.username}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    );
  };