/**
 * Monitor service for ZoneMinder API
 */
import api from './api';
import { Monitor, MonitorsResponse, MonitorItem } from '../types';

class MonitorService {
  /**
   * Get all monitors
   */
  async getMonitors(): Promise<Monitor[]> {
    try {
      const response = await api.get<MonitorsResponse>('/zm/api/monitors.json');
      
      // ZoneMinder returns { monitors: [...] }
      const monitorItems = response.data.monitors;
      
      // Transform the nested structure into flat Monitor objects
      const monitors = monitorItems.map((item: MonitorItem) => ({
        Id: item.Monitor.Id,
        Name: item.Monitor.Name,
        Type: item.Monitor.Type,
        Function: item.Monitor.Function,
        Enabled: item.Monitor.Enabled === 1,
        Host: item.Monitor.Host || '',
        Port: item.Monitor.Port,
        Path: item.Monitor.Path,
        Width: item.Monitor.Width,
        Height: item.Monitor.Height,
        Colours: item.Monitor.Colours,
        Status: item.Monitor_Status?.Status || 'Unknown',
        CaptureFPS: item.Monitor_Status?.CaptureFPS || '0',
        AnalysisFPS: item.Monitor_Status?.AnalysisFPS || '0',
        Deleted: item.Monitor.Deleted || false,
      }));
      
      // Filter out deleted monitors
      const activeMonitors = monitors.filter(monitor => !monitor.Deleted);
      
      return activeMonitors;
    } catch (error) {
      console.error('Failed to fetch monitors:', error);
      throw error;
    }
  }

  /**
   * Get a single monitor by ID
   */
  async getMonitor(id: string): Promise<Monitor> {
    const response = await api.get<{ monitor: Monitor }>(`/zm/api/monitors/${id}.json`);
    return response.data.monitor;
  }
}

export const monitorService = new MonitorService();