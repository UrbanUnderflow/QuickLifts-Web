import React from 'react';
import { getDefaultPulseCheckTeamCommercialConfig, getDefaultPulseCheckRequiredConsents, getDefaultPulseCheckIntakeForm } from '../../../src/api/firebase/pulsecheckProvisioning/types';
export default function Guard({children}) { return <><header style={{padding:'16px 24px',display:'flex',justifyContent:'space-between',borderBottom:'1px solid #dfe5dc'}}><span>Admin / PulseCheck Provisioning</span><span>Local preview · Sample data</span></header>{children}</>; }
const user={id:'preview-admin',email:'admin@example.com',displayName:'Program Admin'};
export const useUser=()=>user;
export const useDispatch=()=>()=>{};
export const auth={currentUser:null};
export const storage=null;
export const getFirebaseModeRequestHeaders=()=>({});
const sports=[{id:'basketball',name:'Basketball',positions:[],emoji:'',sortOrder:0}];
export const getDefaultPulseCheckSports=()=>sports;
export const fetchPulseCheckSportConfiguration=async()=>sports;
const organizations=[
 {id:'north-university',displayName:'North University',legalName:'North University Athletics',status:'active',organizationType:'athletic-department',primaryCustomerAdminName:'Program Admin',primaryCustomerAdminEmail:'admin@example.com',productBrand:'athleticmind',defaultStudyPosture:'operational',defaultClinicianBridgeMode:'optional',additionalAdminContacts:[]},
 {id:'summit-athletics',displayName:'Summit Athletics',status:'ready-for-activation',organizationType:'athletic-club',primaryCustomerAdminEmail:'admin@example.com',productBrand:'pulsecheck',defaultStudyPosture:'pilot',defaultClinicianBridgeMode:'none'},
 {id:'coastal-institute',displayName:'Coastal Institute of Sport and Human Performance',status:'provisioning',organizationType:'sports-academy',primaryCustomerAdminEmail:'admin@example.com',productBrand:'athleticmind',defaultStudyPosture:'operational',defaultClinicianBridgeMode:'required'}
];
const teams=[{id:'north-basketball',organizationId:'north-university',displayName:'Women’s Basketball',teamType:'sport-team',sportOrProgram:'Basketball',sportId:'basketball',status:'active',defaultAdminName:'Program Admin',defaultAdminEmail:'admin@example.com',defaultEscalationRoute:'hotline',defaultInvitePolicy:'admin-and-staff',commercialConfig:getDefaultPulseCheckTeamCommercialConfig(),requiredConsents:getDefaultPulseCheckRequiredConsents('operational'),intakeConfig:{athlete:getDefaultPulseCheckIntakeForm('athlete'),coach:getDefaultPulseCheckIntakeForm('coach')}}];
const pilots=[{id:'fall-program',organizationId:'north-university',teamId:'north-basketball',name:'Fall mental performance pilot',objective:'Build a daily practice',studyMode:'pilot',status:'active',checkpointCadence:'weekly'}];
const cohorts=[{id:'first-cohort',organizationId:'north-university',teamId:'north-basketball',pilotId:'fall-program',name:'Fall cohort',cohortType:'intervention-group',assignmentRule:'manual-staff-assignment',status:'active',reportingTags:[]}];
const lists={listOrganizations:organizations,listTeams:teams,listPilots:pilots,listPilotCohorts:cohorts,listClinicianProfiles:[],listInviteLinks:[],listOrganizationStaffMembers:[],listInviteActivityByToken:[]};
export const pulseCheckProvisioningService=new Proxy({}, {get(_,key){if(key in lists) return async()=>lists[key];return async()=>{throw new Error('This local sample preview does not save changes.');};}});
