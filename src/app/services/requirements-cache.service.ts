
import { Injectable } from '@angular/core';
import {
  OjtRequirement,
  OjtSubmission
} from './requirements.service';

@Injectable({
  providedIn: 'root'
})
export class RequirementsCacheService {
  public requirements: OjtRequirement[] = [];
  public submissions: OjtSubmission[] = [];

  public isLoaded = false;
  public submissionsLoaded = false;
}
