import { analyticsAggregation } from './analytics.aggregation.js';

export const getAnalyticsOverview = () => analyticsAggregation.getOverview();
export const getAppointmentAnalytics = (query) => analyticsAggregation.getAppointmentAnalytics(query);
export const getUserGrowthAnalytics = (query) => analyticsAggregation.getUserGrowthAnalytics(query);
export const getDoctorAnalytics = (query) => analyticsAggregation.getDoctorAnalytics(query);
export const getClinicAnalytics = (query) => analyticsAggregation.getClinicAnalytics(query);
