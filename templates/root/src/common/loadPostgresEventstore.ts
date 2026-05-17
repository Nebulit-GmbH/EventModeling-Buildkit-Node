import {getPostgreSQLEventStore} from "@event-driven-io/emmett-postgresql";
import {projections} from "@event-driven-io/emmett";
import {postgresUrl, getSharedPool} from "./db";
import {CreatedOrganizationsProjection} from "../slices/organization/CreatedOrganizations/CreatedOrganizationsProjection";
import {OrganizationLicenseProjection} from "../slices/organization/OrganizationLicense/OrganizationLicenseProjection";
import {InvitesProjection} from "../slices/organization/Invites/InvitesProjection";
import {OrganizationBoardsProjection} from "../slices/organization/OrganizationBoards/OrganizationBoardsProjection";
import {ActiveTokensProjection} from "../slices/organization/ActiveTokens/ActiveTokensProjection";
import {LicenseSeatsProjection} from "../slices/organization/LicenseSeats/LicenseSeatsProjection";
import {UserOrganizationsProjection} from "../slices/organization/UserOrganizations/UserOrganizationsProjection";
import {EnabledUsersProjection} from "../slices/beta/EnabledUsers/EnabledUsersProjection";

let eventStoreInstance: ReturnType<typeof getPostgreSQLEventStore> | null = null;

export const findEventstore = async () => {
    if (!eventStoreInstance) {
        eventStoreInstance = getPostgreSQLEventStore(postgresUrl, {
            schema: {
                autoMigration: "CreateOrUpdate"
            },
            connectionOptions: {
                pooled: true,
                pool: getSharedPool(),
            },
            projections: projections.inline([
                CreatedOrganizationsProjection,
                OrganizationLicenseProjection,
                InvitesProjection,
                OrganizationBoardsProjection,
                ActiveTokensProjection,
                LicenseSeatsProjection,
                UserOrganizationsProjection,
                EnabledUsersProjection,
            ]),
        });
        await eventStoreInstance.schema.migrate();
    }
    return eventStoreInstance;
};
