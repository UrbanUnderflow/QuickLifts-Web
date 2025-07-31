import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { kanbanService } from '../../api/firebase/kanban/service';
import { KanbanTask } from '../../api/firebase/kanban/types';
import { Plus, Edit, Trash2, Calendar, User, Tag, GripVertical, Clock, Filter, ChevronDown } from 'lucide-react';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../api/firebase/config';
import { adminMethods } from '../../api/firebase/admin/methods';

type TaskStatus = 'todo' | 'in-progress' | 'done';

type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  username: string;
};

interface TaskCardProps {
  task: KanbanTask;
  onEdit: (task: KanbanTask) => void;
  onDelete: (taskId: string) => void;
  onDragStart: (e: React.DragEvent, task: KanbanTask) => void;
  onClick: (task: KanbanTask) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, onEdit, onDelete, onDragStart, onClick }) => {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(date);
  };

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task)}
      onClick={() => onClick(task)}
      className="bg-[#1a1e24] border border-zinc-700 rounded-lg p-4 mb-3 cursor-pointer hover:border-zinc-600 transition-colors group"
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="text-white font-medium text-sm leading-5 flex-1 mr-2">{task.name}</h4>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(task);
            }}
            className="p-1 text-zinc-400 hover:text-blue-400 transition-colors"
            title="Quick edit task"
          >
            <Edit className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(task.id);
            }}
            className="p-1 text-zinc-400 hover:text-red-400 transition-colors"
            title="Delete task"
          >
            <Trash2 className="w-3 h-3" />
          </button>
          <GripVertical className="w-3 h-3 text-zinc-600" />
        </div>
      </div>
      
      {task.description && (
        <p className="text-zinc-400 text-xs mb-3 line-clamp-2">{task.description}</p>
      )}
      
      <div className="space-y-2">
        {task.project && (
          <div className="flex items-center gap-1 text-xs text-zinc-500">
            <Tag className="w-3 h-3" />
            <span className="font-medium">Project:</span>
            <span>{task.project}</span>
          </div>
        )}
        
        {task.theme && (
          <div className="flex items-center gap-1 text-xs text-zinc-500">
            <Clock className="w-3 h-3" />
            <span className="font-medium">Theme:</span>
            <span>{task.theme}</span>
          </div>
        )}
        
        {task.assignee && (
          <div className="flex items-center gap-1 text-xs text-zinc-500">
            <User className="w-3 h-3" />
            <span className="font-medium">Assignee:</span>
            <span>{task.assignee}</span>
          </div>
        )}
        
        <div className="flex items-center gap-1 text-xs text-zinc-500">
          <Calendar className="w-3 h-3" />
          <span>{formatDate(task.createdAt)}</span>
        </div>
      </div>
    </div>
  );
};

interface TaskDetailModalProps {
  task: KanbanTask | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Partial<KanbanTask>) => void;
  onDelete: (taskId: string) => void;
}

const TaskDetailModal: React.FC<TaskDetailModalProps> = ({ task, isOpen, onClose, onSave, onDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    project: '',
    theme: '',
    assignee: '',
    status: 'todo' as TaskStatus
  });

  // Project and Theme autocomplete states
  const [existingProjects, setExistingProjects] = useState<string[]>([]);
  const [existingThemes, setExistingThemes] = useState<string[]>([]);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [showThemeDropdown, setShowThemeDropdown] = useState(false);

  // @ tagging system for assignee
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [loadingAdminUsers, setLoadingAdminUsers] = useState(false);
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
  const [assigneeQuery, setAssigneeQuery] = useState('');

  // Load existing projects and themes when modal opens
  useEffect(() => {
    if (isOpen && isEditing) {
      loadExistingProjectsAndThemes();
    }
  }, [isOpen, isEditing]);

  const loadExistingProjectsAndThemes = async () => {
    try {
      const allTasks = await kanbanService.fetchAllTasks();
      
      const projects = allTasks
        .map(t => t.project)
        .filter(project => project && project.trim() !== '')
        .filter((project, index, array) => array.indexOf(project) === index)
        .sort();
      
      const themes = allTasks
        .map(t => t.theme)
        .filter(theme => theme && theme.trim() !== '')
        .filter((theme, index, array) => array.indexOf(theme) === index)
        .sort();

      setExistingProjects(projects);
      setExistingThemes(themes);
    } catch (error) {
      console.error('Error loading projects and themes:', error);
    }
  };

  useEffect(() => {
    if (task) {
      setFormData({
        name: task.name,
        description: task.description,
        project: task.project,
        theme: task.theme,
        assignee: task.assignee,
        status: task.status
      });
      setAssigneeQuery(task.assignee);
    }
    setIsEditing(false);
  }, [task, isOpen]);

  // Filter existing projects and themes
  const filteredProjects = React.useMemo(() => {
    if (!formData.project) return existingProjects;
    const query = formData.project.toLowerCase();
    return existingProjects.filter(project => 
      project.toLowerCase().includes(query)
    );
  }, [existingProjects, formData.project]);

  const filteredThemes = React.useMemo(() => {
    if (!formData.theme) return existingThemes;
    const query = formData.theme.toLowerCase();
    return existingThemes.filter(theme => 
      theme.toLowerCase().includes(query)
    );
  }, [existingThemes, formData.theme]);

  // Admin user search function
  const searchAdminUsers = async (searchQuery: string) => {
    if (!searchQuery || searchQuery.length < 2) {
      setAdminUsers([]);
      return;
    }

    try {
      setLoadingAdminUsers(true);
      const usersRef = collection(db, 'users');
      const q = query(usersRef, orderBy('displayName'));
      const querySnapshot = await getDocs(q);
      
      const allUsers = querySnapshot.docs.map(doc => ({
        id: doc.id,
        email: doc.data().email || '',
        displayName: doc.data().displayName || '',
        username: doc.data().username || '',
      })).filter(user => user.email);

      const filteredUsers = allUsers.filter(user => {
        const searchLower = searchQuery.toLowerCase();
        return (
          user.displayName.toLowerCase().includes(searchLower) ||
          user.username.toLowerCase().includes(searchLower) ||
          user.email.toLowerCase().includes(searchLower)
        );
      });

      const adminUsersList = [];
      for (const user of filteredUsers.slice(0, 10)) {
        try {
          const isAdmin = await adminMethods.isAdmin(user.email);
          if (isAdmin) {
            adminUsersList.push(user);
          }
        } catch (error) {
          console.warn(`Error checking admin for ${user.email}:`, error);
        }
      }

      setAdminUsers(adminUsersList);
    } catch (error) {
      console.error('Error searching admin users:', error);
      setAdminUsers([]);
    } finally {
      setLoadingAdminUsers(false);
    }
  };

  const handleAssigneeInputChange = (value: string) => {
    setAssigneeQuery(value);
    setFormData({ ...formData, assignee: value });

    if (value.includes('@')) {
      const searchTerm = value.split('@').pop() || '';
      if (searchTerm.length >= 1) {
        searchAdminUsers(searchTerm);
        setShowAssigneeDropdown(true);
      } else {
        setAdminUsers([]);
        setShowAssigneeDropdown(false);
      }
    } else if (value.length >= 2) {
      searchAdminUsers(value);
      setShowAssigneeDropdown(true);
    } else {
      setAdminUsers([]);
      setShowAssigneeDropdown(false);
    }
  };

  const handleSave = () => {
    if (!task || !formData.name.trim()) return;
    onSave({ ...task, ...formData });
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (!task) return;
    if (confirm('Are you sure you want to delete this task?')) {
      onDelete(task.id);
      onClose();
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'todo':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'in-progress':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'done':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      default:
        return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30';
    }
  };

  if (!isOpen || !task) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1e24] border border-zinc-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-700">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-white">Task Details</h2>
            <div className={`px-2 py-1 rounded-md text-xs font-medium border ${getStatusColor(task.status)}`}>
              {task.status === 'in-progress' ? 'In Progress' : task.status.charAt(0).toUpperCase() + task.status.slice(1)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isEditing ? (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={handleDelete}
                  className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleSave}
                  className="px-3 py-2 bg-[#d7ff00] text-black font-medium rounded-lg hover:bg-[#c4e600] transition-colors"
                >
                  Save Changes
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition-colors"
                >
                  Cancel
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-700 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {!isEditing ? (
            /* View Mode */
            <>
              <div>
                <h3 className="text-lg font-medium text-white mb-2">{task.name}</h3>
                {task.description && (
                  <p className="text-zinc-300 leading-relaxed">{task.description}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {task.project && (
                  <div className="bg-[#262a30] rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Tag className="w-4 h-4 text-blue-400" />
                      <span className="text-sm font-medium text-zinc-400">Project</span>
                    </div>
                    <p className="text-white">{task.project}</p>
                    <p className="text-xs text-zinc-500 mt-1">Quarterly Goal</p>
                  </div>
                )}

                {task.theme && (
                  <div className="bg-[#262a30] rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-purple-400" />
                      <span className="text-sm font-medium text-zinc-400">Theme</span>
                    </div>
                    <p className="text-white">{task.theme}</p>
                    <p className="text-xs text-zinc-500 mt-1">Monthly Focus</p>
                  </div>
                )}

                {task.assignee && (
                  <div className="bg-[#262a30] rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="w-4 h-4 text-green-400" />
                      <span className="text-sm font-medium text-zinc-400">Assignee</span>
                    </div>
                    <p className="text-white">{task.assignee}</p>
                  </div>
                )}

                <div className="bg-[#262a30] rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-4 h-4 text-orange-400" />
                    <span className="text-sm font-medium text-zinc-400">Created</span>
                  </div>
                  <p className="text-white">{formatDate(task.createdAt)}</p>
                  {task.updatedAt && task.updatedAt.getTime() !== task.createdAt.getTime() && (
                    <p className="text-xs text-zinc-500 mt-1">Updated: {formatDate(task.updatedAt)}</p>
                  )}
                </div>
              </div>
            </>
          ) : (
            /* Edit Mode - similar to the original TaskModal but with more space */
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Task Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-[#262a30] border border-zinc-600 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                  placeholder="Enter task name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-[#262a30] border border-zinc-600 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 resize-none"
                  placeholder="Enter task description"
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Project <span className="text-zinc-500 text-xs">(Quarterly)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.project}
                    onChange={(e) => {
                      setFormData({ ...formData, project: e.target.value });
                      setShowProjectDropdown(e.target.value.length > 0 && filteredProjects.length > 0);
                    }}
                    onFocus={() => formData.project.length > 0 && filteredProjects.length > 0 && setShowProjectDropdown(true)}
                    onBlur={() => setTimeout(() => setShowProjectDropdown(false), 150)}
                    className="w-full px-3 py-2 bg-[#262a30] border border-zinc-600 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                    placeholder="Q1 Goals"
                  />
                  
                  {showProjectDropdown && filteredProjects.length > 0 && (
                    <div className="absolute z-20 w-full mt-1 bg-[#262a30] border border-zinc-600 rounded-lg shadow-lg max-h-32 overflow-y-auto">
                      {filteredProjects.map((project) => (
                        <button
                          key={project}
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, project });
                            setShowProjectDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-[#1a1e24] text-white text-sm border-b border-zinc-700 last:border-b-0"
                        >
                          {project}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="relative">
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Theme <span className="text-zinc-500 text-xs">(Monthly)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.theme}
                    onChange={(e) => {
                      setFormData({ ...formData, theme: e.target.value });
                      setShowThemeDropdown(e.target.value.length > 0 && filteredThemes.length > 0);
                    }}
                    onFocus={() => formData.theme.length > 0 && filteredThemes.length > 0 && setShowThemeDropdown(true)}
                    onBlur={() => setTimeout(() => setShowThemeDropdown(false), 150)}
                    className="w-full px-3 py-2 bg-[#262a30] border border-zinc-600 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                    placeholder="March Focus"
                  />
                  
                  {showThemeDropdown && filteredThemes.length > 0 && (
                    <div className="absolute z-20 w-full mt-1 bg-[#262a30] border border-zinc-600 rounded-lg shadow-lg max-h-32 overflow-y-auto">
                      {filteredThemes.map((theme) => (
                        <button
                          key={theme}
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, theme });
                            setShowThemeDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-[#1a1e24] text-white text-sm border-b border-zinc-700 last:border-b-0"
                        >
                          {theme}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Assignee <span className="text-zinc-500 text-xs">(Type @ to search admin users)</span>
                  </label>
                  <input
                    type="text"
                    value={assigneeQuery}
                    onChange={(e) => handleAssigneeInputChange(e.target.value)}
                    className="w-full px-3 py-2 bg-[#262a30] border border-zinc-600 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                    placeholder="Enter assignee name or type @ to search admin users"
                  />
                  {loadingAdminUsers && (
                    <div className="absolute right-2 top-9">
                      <div className="w-4 h-4 border-2 border-zinc-500 border-t-blue-500 rounded-full animate-spin"></div>
                    </div>
                  )}
                  
                  {showAssigneeDropdown && adminUsers.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-[#262a30] border border-zinc-600 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {adminUsers.map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => {
                            const displayName = user.displayName || user.username || user.email;
                            setFormData({ ...formData, assignee: displayName });
                            setAssigneeQuery(displayName);
                            setShowAssigneeDropdown(false);
                            setAdminUsers([]);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-[#1a1e24] text-white text-sm border-b border-zinc-700 last:border-b-0 flex items-center gap-2"
                        >
                          <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-xs font-medium">
                            {(user.displayName || user.username || user.email).charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium">{user.displayName || user.username}</div>
                            <div className="text-xs text-zinc-400">{user.email}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as TaskStatus })}
                    className="w-full px-3 py-2 bg-[#262a30] border border-zinc-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="todo">Todo</option>
                    <option value="in-progress">In Progress</option>
                    <option value="done">Done</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface TaskModalProps {
  task: KanbanTask | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Partial<KanbanTask>) => void;
  mode: 'create' | 'edit';
}

const TaskModal: React.FC<TaskModalProps> = ({ task, isOpen, onClose, onSave, mode }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    project: '',
    theme: '',
    assignee: '',
    status: 'todo' as TaskStatus
  });

  // @ tagging system for assignee (similar to programming page)
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [loadingAdminUsers, setLoadingAdminUsers] = useState(false);
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
  const [assigneeQuery, setAssigneeQuery] = useState('');

  // Project and Theme autocomplete states
  const [existingProjects, setExistingProjects] = useState<string[]>([]);
  const [existingThemes, setExistingThemes] = useState<string[]>([]);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [showThemeDropdown, setShowThemeDropdown] = useState(false);
  const [loadingProjectsThemes, setLoadingProjectsThemes] = useState(false);

  // Load existing projects and themes when modal opens
  useEffect(() => {
    if (isOpen) {
      loadExistingProjectsAndThemes();
    }
  }, [isOpen]);

  const loadExistingProjectsAndThemes = async () => {
    try {
      setLoadingProjectsThemes(true);
      const allTasks = await kanbanService.fetchAllTasks();
      
      // Extract unique projects and themes
      const projects = allTasks
        .map(task => task.project)
        .filter(project => project && project.trim() !== '')
        .filter((project, index, array) => array.indexOf(project) === index)
        .sort();
      
      const themes = allTasks
        .map(task => task.theme)
        .filter(theme => theme && theme.trim() !== '')
        .filter((theme, index, array) => array.indexOf(theme) === index)
        .sort();

      setExistingProjects(projects);
      setExistingThemes(themes);
      console.log(`[ProjectManagement] Loaded ${projects.length} projects and ${themes.length} themes`);
    } catch (error) {
      console.error('[ProjectManagement] Error loading projects and themes:', error);
      setExistingProjects([]);
      setExistingThemes([]);
    } finally {
      setLoadingProjectsThemes(false);
    }
  };

  useEffect(() => {
    if (task) {
      setFormData({
        name: task.name,
        description: task.description,
        project: task.project,
        theme: task.theme,
        assignee: task.assignee,
        status: task.status
      });
      setAssigneeQuery(task.assignee);
    } else {
      setFormData({
        name: '',
        description: '',
        project: '',
        theme: '',
        assignee: '',
        status: 'todo'
      });
      setAssigneeQuery('');
    }
  }, [task, isOpen]);

  // Filter existing projects based on input
  const filteredProjects = React.useMemo(() => {
    if (!formData.project) return existingProjects;
    const query = formData.project.toLowerCase();
    return existingProjects.filter(project => 
      project.toLowerCase().includes(query)
    );
  }, [existingProjects, formData.project]);

  // Filter existing themes based on input
  const filteredThemes = React.useMemo(() => {
    if (!formData.theme) return existingThemes;
    const query = formData.theme.toLowerCase();
    return existingThemes.filter(theme => 
      theme.toLowerCase().includes(query)
    );
  }, [existingThemes, formData.theme]);

  const handleProjectInputChange = (value: string) => {
    setFormData({ ...formData, project: value });
    setShowProjectDropdown(value.length > 0 && filteredProjects.length > 0);
  };

  const handleThemeInputChange = (value: string) => {
    setFormData({ ...formData, theme: value });
    setShowThemeDropdown(value.length > 0 && filteredThemes.length > 0);
  };

  const handleProjectSelect = (project: string) => {
    setFormData({ ...formData, project });
    setShowProjectDropdown(false);
  };

  const handleThemeSelect = (theme: string) => {
    setFormData({ ...formData, theme });
    setShowThemeDropdown(false);
  };

  // Search admin users when @ is typed (similar to programming page approach)
  const searchAdminUsers = async (searchQuery: string) => {
    if (!searchQuery || searchQuery.length < 2) {
      setAdminUsers([]);
      return;
    }

    try {
      setLoadingAdminUsers(true);
      console.log(`[ProjectManagement] Searching admin users with query: "${searchQuery}"`);
      
      // Fetch all users first
      const usersRef = collection(db, 'users');
      const q = query(usersRef, orderBy('displayName'));
      const querySnapshot = await getDocs(q);
      
      const allUsers = querySnapshot.docs.map(doc => ({
        id: doc.id,
        email: doc.data().email || '',
        displayName: doc.data().displayName || '',
        username: doc.data().username || '',
      })).filter(user => user.email); // Only users with email

      // Filter users by search query
      const filteredUsers = allUsers.filter(user => {
        const searchLower = searchQuery.toLowerCase();
        return (
          user.displayName.toLowerCase().includes(searchLower) ||
          user.username.toLowerCase().includes(searchLower) ||
          user.email.toLowerCase().includes(searchLower)
        );
      });

      console.log(`[ProjectManagement] Found ${filteredUsers.length} matching users, checking admin status...`);

      // Check admin status for filtered users only
      const adminUsers = [];
      for (const user of filteredUsers.slice(0, 10)) { // Limit to first 10 matches for performance
        try {
          const isAdmin = await adminMethods.isAdmin(user.email);
          if (isAdmin) {
            adminUsers.push(user);
          }
        } catch (error) {
          console.warn(`[ProjectManagement] Error checking admin for ${user.email}:`, error);
        }
      }

      console.log(`[ProjectManagement] Found ${adminUsers.length} admin users matching "${searchQuery}"`);
      setAdminUsers(adminUsers);
    } catch (error) {
      console.error('[ProjectManagement] Error searching admin users:', error);
      setAdminUsers([]);
    } finally {
      setLoadingAdminUsers(false);
    }
  };

  const handleAssigneeSelect = (user: AdminUser) => {
    const displayName = user.displayName || user.username || user.email;
    setFormData({ ...formData, assignee: displayName });
    setAssigneeQuery(displayName);
    setShowAssigneeDropdown(false);
    setAdminUsers([]);
  };

  const handleAssigneeInputChange = (value: string) => {
    setAssigneeQuery(value);
    setFormData({ ...formData, assignee: value });

    // Trigger search when @ is used (similar to programming page)
    if (value.includes('@')) {
      const searchTerm = value.split('@').pop() || '';
      if (searchTerm.length >= 1) {
        searchAdminUsers(searchTerm);
        setShowAssigneeDropdown(true);
      } else {
        setAdminUsers([]);
        setShowAssigneeDropdown(false);
      }
    } else if (value.length >= 2) {
      // Also search without @ if they type enough characters
      searchAdminUsers(value);
      setShowAssigneeDropdown(true);
    } else {
      setAdminUsers([]);
      setShowAssigneeDropdown(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    if (mode === 'edit' && task) {
      onSave({ ...task, ...formData });
    } else {
      onSave(formData);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1e24] border border-zinc-700 rounded-xl p-6 w-full max-w-md">
        <h3 className="text-xl font-semibold text-white mb-4">
          {mode === 'create' ? 'Create New Task' : 'Edit Task'}
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Task Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 bg-[#262a30] border border-zinc-600 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
              placeholder="Enter task name"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 bg-[#262a30] border border-zinc-600 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 resize-none"
              placeholder="Enter task description"
              rows={3}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <label className="block text-sm font-medium text-zinc-300 mb-1">
                Project <span className="text-zinc-500 text-xs">(Quarterly)</span>
              </label>
              <input
                type="text"
                value={formData.project}
                onChange={(e) => handleProjectInputChange(e.target.value)}
                onFocus={() => formData.project.length > 0 && filteredProjects.length > 0 && setShowProjectDropdown(true)}
                onBlur={() => setTimeout(() => setShowProjectDropdown(false), 150)}
                className="w-full px-3 py-2 bg-[#262a30] border border-zinc-600 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                placeholder="Q1 Goals"
              />
              
              {/* Project Dropdown */}
              {showProjectDropdown && filteredProjects.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-[#262a30] border border-zinc-600 rounded-lg shadow-lg max-h-32 overflow-y-auto">
                  {filteredProjects.map((project) => (
                    <button
                      key={project}
                      type="button"
                      onClick={() => handleProjectSelect(project)}
                      className="w-full text-left px-3 py-2 hover:bg-[#1a1e24] text-white text-sm border-b border-zinc-700 last:border-b-0"
                    >
                      {project}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <div className="relative">
              <label className="block text-sm font-medium text-zinc-300 mb-1">
                Theme <span className="text-zinc-500 text-xs">(Monthly)</span>
              </label>
              <input
                type="text"
                value={formData.theme}
                onChange={(e) => handleThemeInputChange(e.target.value)}
                onFocus={() => formData.theme.length > 0 && filteredThemes.length > 0 && setShowThemeDropdown(true)}
                onBlur={() => setTimeout(() => setShowThemeDropdown(false), 150)}
                className="w-full px-3 py-2 bg-[#262a30] border border-zinc-600 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                placeholder="March Focus"
              />
              
              {/* Theme Dropdown */}
              {showThemeDropdown && filteredThemes.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-[#262a30] border border-zinc-600 rounded-lg shadow-lg max-h-32 overflow-y-auto">
                  {filteredThemes.map((theme) => (
                    <button
                      key={theme}
                      type="button"
                      onClick={() => handleThemeSelect(theme)}
                      className="w-full text-left px-3 py-2 hover:bg-[#1a1e24] text-white text-sm border-b border-zinc-700 last:border-b-0"
                    >
                      {theme}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <div className="relative">
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Assignee <span className="text-zinc-500 text-xs">(Type @ to search admin users)</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={assigneeQuery}
                onChange={(e) => handleAssigneeInputChange(e.target.value)}
                className="w-full px-3 py-2 bg-[#262a30] border border-zinc-600 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                placeholder="Enter assignee name or type @ to search admin users"
              />
              {loadingAdminUsers && (
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-zinc-500 border-t-blue-500 rounded-full animate-spin"></div>
                </div>
              )}
            </div>
            
            {/* Admin Users Dropdown */}
            {showAssigneeDropdown && adminUsers.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-[#262a30] border border-zinc-600 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                {adminUsers.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => handleAssigneeSelect(user)}
                    className="w-full text-left px-3 py-2 hover:bg-[#1a1e24] text-white text-sm border-b border-zinc-700 last:border-b-0 flex items-center gap-2"
                  >
                    <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-xs font-medium">
                      {(user.displayName || user.username || user.email).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium">{user.displayName || user.username}</div>
                      <div className="text-xs text-zinc-400">{user.email}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            
            {/* Show help text when @ is typed but no results */}
            {showAssigneeDropdown && adminUsers.length === 0 && !loadingAdminUsers && assigneeQuery.includes('@') && (
              <div className="absolute z-10 w-full mt-1 bg-[#262a30] border border-zinc-600 rounded-lg shadow-lg p-3">
                <div className="text-zinc-400 text-sm">
                  No admin users found. Try a different search term.
                </div>
              </div>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as TaskStatus })}
              className="w-full px-3 py-2 bg-[#262a30] border border-zinc-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              <option value="todo">Todo</option>
              <option value="in-progress">In Progress</option>
              <option value="done">Done</option>
            </select>
          </div>
          
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-[#d7ff00] text-black font-medium py-2 px-4 rounded-lg hover:bg-[#c4e600] transition-colors"
            >
              {mode === 'create' ? 'Create Task' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-zinc-700 text-white font-medium py-2 px-4 rounded-lg hover:bg-zinc-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface ColumnProps {
  title: string;
  status: TaskStatus;
  tasks: KanbanTask[];
  onTaskEdit: (task: KanbanTask) => void;
  onTaskDelete: (taskId: string) => void;
  onTaskClick: (task: KanbanTask) => void;
  onDragStart: (e: React.DragEvent, task: KanbanTask) => void;
  onDrop: (e: React.DragEvent, status: TaskStatus) => void;
  onDragOver: (e: React.DragEvent) => void;
}

const Column: React.FC<ColumnProps> = ({
  title,
  status,
  tasks,
  onTaskEdit,
  onTaskDelete,
  onTaskClick,
  onDragStart,
  onDrop,
  onDragOver
}) => {
  const getColumnColor = () => {
    switch (status) {
      case 'todo':
        return 'border-blue-500/30 bg-blue-500/5';
      case 'in-progress':
        return 'border-yellow-500/30 bg-yellow-500/5';
      case 'done':
        return 'border-green-500/30 bg-green-500/5';
      default:
        return 'border-zinc-700';
    }
  };

  const getHeaderColor = () => {
    switch (status) {
      case 'todo':
        return 'text-blue-400';
      case 'in-progress':
        return 'text-yellow-400';
      case 'done':
        return 'text-green-400';
      default:
        return 'text-zinc-400';
    }
  };

  return (
    <div
      className={`flex-1 bg-[#111417] border rounded-xl p-4 min-h-[500px] ${getColumnColor()}`}
      onDrop={(e) => onDrop(e, status)}
      onDragOver={onDragOver}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className={`font-semibold text-lg ${getHeaderColor()}`}>
          {title}
        </h3>
        <span className="bg-zinc-800 text-zinc-400 text-xs px-2 py-1 rounded-full">
          {tasks.length}
        </span>
      </div>
      
      <div className="space-y-3">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onEdit={onTaskEdit}
            onDelete={onTaskDelete}
            onDragStart={onDragStart}
            onClick={onTaskClick}
          />
        ))}
      </div>
    </div>
  );
};

const ProjectManagement: React.FC = () => {
  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedTask, setSelectedTask] = useState<KanbanTask | null>(null);
  const [draggedTask, setDraggedTask] = useState<KanbanTask | null>(null);
  const [taskDetailModalOpen, setTaskDetailModalOpen] = useState(false);
  
  // Filter states
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [selectedTheme, setSelectedTheme] = useState<string>('all');
  const [selectedAssignee, setSelectedAssignee] = useState<string>('all');

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const fetchedTasks = await kanbanService.fetchAllTasks();
      setTasks(fetchedTasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Get unique projects, themes, and assignees from tasks
  const uniqueProjects = React.useMemo(() => {
    const projects = tasks
      .map(task => task.project)
      .filter(project => project && project.trim() !== '')
      .filter((project, index, array) => array.indexOf(project) === index)
      .sort();
    return projects;
  }, [tasks]);

  const uniqueThemes = React.useMemo(() => {
    const themes = tasks
      .map(task => task.theme)
      .filter(theme => theme && theme.trim() !== '')
      .filter((theme, index, array) => array.indexOf(theme) === index)
      .sort();
    return themes;
  }, [tasks]);

  const uniqueAssignees = React.useMemo(() => {
    const assignees = tasks
      .map(task => task.assignee)
      .filter(assignee => assignee && assignee.trim() !== '')
      .filter((assignee, index, array) => array.indexOf(assignee) === index)
      .sort();
    return assignees;
  }, [tasks]);

  // Filter tasks based on selected project, theme, and assignee
  const filteredTasks = React.useMemo(() => {
    return tasks.filter(task => {
      const matchesProject = selectedProject === 'all' || task.project === selectedProject;
      const matchesTheme = selectedTheme === 'all' || task.theme === selectedTheme;
      const matchesAssignee = selectedAssignee === 'all' || task.assignee === selectedAssignee;
      return matchesProject && matchesTheme && matchesAssignee;
    });
  }, [tasks, selectedProject, selectedTheme, selectedAssignee]);

  const handleCreateTask = () => {
    setSelectedTask(null);
    setModalMode('create');
    setIsModalOpen(true);
  };

  const handleEditTask = (task: KanbanTask) => {
    setSelectedTask(task);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    
    try {
      await kanbanService.deleteTask(taskId);
      await fetchTasks();
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const handleSaveTask = async (taskData: Partial<KanbanTask>) => {
    try {
      if (modalMode === 'create') {
        await kanbanService.createTask({
          name: taskData.name!,
          description: taskData.description!,
          project: taskData.project!,
          theme: taskData.theme!,
          assignee: taskData.assignee!,
          status: taskData.status!
        });
      } else if (selectedTask) {
        await kanbanService.updateTask(selectedTask.id, {
          name: taskData.name,
          description: taskData.description,
          project: taskData.project,
          theme: taskData.theme,
          assignee: taskData.assignee,
          status: taskData.status
        });
      }
      await fetchTasks();
    } catch (error) {
      console.error('Error saving task:', error);
    }
  };

  const handleDragStart = (e: React.DragEvent, task: KanbanTask) => {
    setDraggedTask(task);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, newStatus: TaskStatus) => {
    e.preventDefault();
    
    if (!draggedTask || draggedTask.status === newStatus) {
      setDraggedTask(null);
      return;
    }

    try {
      await kanbanService.updateTaskStatus(draggedTask.id, newStatus);
      await fetchTasks();
    } catch (error) {
      console.error('Error updating task status:', error);
    } finally {
      setDraggedTask(null);
    }
  };

  const handleViewTaskDetails = (task: KanbanTask) => {
    setSelectedTask(task);
    setTaskDetailModalOpen(true);
  };

  const todoTasks = filteredTasks.filter(task => task.status === 'todo');
  const inProgressTasks = filteredTasks.filter(task => task.status === 'in-progress');
  const doneTasks = filteredTasks.filter(task => task.status === 'done');

  return (
    <AdminRouteGuard>
      <Head>
        <title>Project Management - Pulse Admin</title>
      </Head>
      
      <div className="min-h-screen bg-[#111417] text-white py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Project Management</h1>
              <p className="text-zinc-400">Kanban board for tracking development tasks and project progress</p>
            </div>
            
            <button
              onClick={handleCreateTask}
              className="bg-[#d7ff00] text-black font-medium px-4 py-2 rounded-lg hover:bg-[#c4e600] transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Task
            </button>
          </div>

          {/* Filter Section */}
          <div className="bg-[#1a1e24] border border-zinc-700 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-zinc-400">
                <Filter className="w-4 h-4" />
                <span className="text-sm font-medium">Filters:</span>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-zinc-400">Project:</label>
                  <select
                    value={selectedProject}
                    onChange={(e) => setSelectedProject(e.target.value)}
                    className="bg-[#262a30] border border-zinc-600 rounded-lg px-3 py-1 text-white text-sm focus:outline-none focus:border-blue-500 min-w-[140px]"
                  >
                    <option value="all">All Projects</option>
                    {uniqueProjects.map(project => (
                      <option key={project} value={project}>{project}</option>
                    ))}
                  </select>
                </div>
                
                <div className="flex items-center gap-2">
                  <label className="text-sm text-zinc-400">Theme:</label>
                  <select
                    value={selectedTheme}
                    onChange={(e) => setSelectedTheme(e.target.value)}
                    className="bg-[#262a30] border border-zinc-600 rounded-lg px-3 py-1 text-white text-sm focus:outline-none focus:border-blue-500 min-w-[140px]"
                  >
                    <option value="all">All Themes</option>
                    {uniqueThemes.map(theme => (
                      <option key={theme} value={theme}>{theme}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-sm text-zinc-400">Assignee:</label>
                  <select
                    value={selectedAssignee}
                    onChange={(e) => setSelectedAssignee(e.target.value)}
                    className="bg-[#262a30] border border-zinc-600 rounded-lg px-3 py-1 text-white text-sm focus:outline-none focus:border-blue-500 min-w-[140px]"
                  >
                    <option value="all">All Assignees</option>
                    {uniqueAssignees.map(assignee => (
                      <option key={assignee} value={assignee}>{assignee}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Active filters indicator */}
              {(selectedProject !== 'all' || selectedTheme !== 'all' || selectedAssignee !== 'all') && (
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-xs text-zinc-500">
                    Showing {filteredTasks.length} of {tasks.length} tasks
                  </span>
                  <button
                    onClick={() => {
                      setSelectedProject('all');
                      setSelectedTheme('all');
                      setSelectedAssignee('all');
                    }}
                    className="text-xs text-blue-400 hover:text-blue-300 underline"
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-zinc-400">Loading tasks...</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Column
                title="Todo"
                status="todo"
                tasks={todoTasks}
                onTaskEdit={handleEditTask}
                onTaskDelete={handleDeleteTask}
                onTaskClick={handleViewTaskDetails}
                onDragStart={handleDragStart}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              />
              
              <Column
                title="In Progress"
                status="in-progress"
                tasks={inProgressTasks}
                onTaskEdit={handleEditTask}
                onTaskDelete={handleDeleteTask}
                onTaskClick={handleViewTaskDetails}
                onDragStart={handleDragStart}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              />
              
              <Column
                title="Done"
                status="done"
                tasks={doneTasks}
                onTaskEdit={handleEditTask}
                onTaskDelete={handleDeleteTask}
                onTaskClick={handleViewTaskDetails}
                onDragStart={handleDragStart}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              />
            </div>
          )}

          <TaskModal
            task={selectedTask}
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            onSave={handleSaveTask}
            mode={modalMode}
          />

          <TaskDetailModal
            task={selectedTask}
            isOpen={taskDetailModalOpen}
            onClose={() => setTaskDetailModalOpen(false)}
            onSave={handleSaveTask}
            onDelete={handleDeleteTask}
          />
        </div>
      </div>
    </AdminRouteGuard>
  );
};

export default ProjectManagement; 